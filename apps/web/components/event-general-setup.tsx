"use client";

/**
 * The event manager's General tab: name, dates, sign-ups, review rules and
 * privacy. It used to be an inline form that opened above the tab bar from an
 * "Edit" link; it is now always-on, grouped into sections, with one save bar
 * that knows when something is unsaved.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  EVENT_FORMATION_MODES,
  EVENT_SUBMISSION_POLICIES,
  type EventDetail,
  type EventScheduleInput,
  type EventTeam,
} from "@droptracker/api-types";
import {
  FORMATION_MODE_HELP,
  FORMATION_MODE_LABELS,
  SUBMISSION_POLICY_HELP,
  SUBMISSION_POLICY_LABELS,
  soloAllowed,
} from "@/lib/events";
import { getErrorMessage, unwrapActionResult } from "@/lib/errors";
import { materializeSchedule } from "@/lib/event-schedule";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { Alert, Button } from "@/components/ui";
import { EventScheduleBuilder } from "@/components/event-schedule-builder";
import { TimezoneNote } from "@/components/local-time";
import { updateGroupEvent } from "@/app/(site)/(admin)/groups/[id]/events/actions";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";

/** Convert a datetime-local value to unix seconds (or null). */
const toUnix = (v: string): number | null => (v ? Math.floor(new Date(v).getTime() / 1000) : null);
/** Convert unix seconds to a datetime-local value (or ""). */
const fromUnix = (v: number | null): string => {
  if (!v) return "";
  const d = new Date(v * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** An event's stored recurring rule as builder input (null = continuous). */
const scheduleInputFor = (event: EventDetail): EventScheduleInput | null =>
  event.schedule?.rule ? { tz: "UTC", rule: event.schedule.rule } : null;

const draftFromEvent = (event: EventDetail) => ({
  name: event.name,
  description: event.description ?? "",
  startsAt: fromUnix(event.starts_at),
  endsAt: fromUnix(event.ends_at),
  schedule: scheduleInputFor(event),
  formationMode: event.formation_mode,
  joinCode: event.join_code ?? "",
  isPrivate: event.visibility === "private",
  requiresConfirmation: event.requires_confirmation,
  allowLiveEdits: event.allow_live_edits,
  effortVisibility: event.effort_visibility,
  tasksVisibility: event.tasks_visibility,
  allowLateSignups: event.allow_late_signups,
  submissionPolicy: event.submission_policy,
  leadershipEnabled: event.leadership.enabled,
  coLeaders: event.leadership.co_leaders,
  leaderSelection: event.leadership.selection,
});
type Draft = ReturnType<typeof draftFromEvent>;

export const GENERAL_TAB_LEAVE_MESSAGE =
  "The General tab has unsaved changes. They stay on the tab for now, but nothing changes until you save. Switch tabs anyway?";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-osrs-bronze/25 space-y-3 rounded border p-4">
      <div>
        <h4 className="text-osrs-gold text-sm font-semibold">{title}</h4>
        {hint && <p className="text-osrs-parchment-dark/60 mt-0.5 text-xs">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Check({
  checked,
  onChange,
  label,
  help,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  help: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4"
      />
      <span>
        {label}
        <span className="text-osrs-parchment-dark/60 block text-xs">{help}</span>
      </span>
    </label>
  );
}

export function EventGeneralSetup({
  groupId,
  event,
  teams,
  onSaved,
  onDirtyChange,
}: {
  groupId: number | null;
  event: EventDetail;
  teams: EventTeam[];
  /** The saved event, so the manager can refresh tasks, teams and header. */
  onSaved: (updated: EventDetail) => void;
  /** Reported so the manager can warn before switching tabs. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const baseline = useMemo(() => draftFromEvent(event), [event]);
  const [draft, setDraft] = useState<Draft>(baseline);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // The event changes under this tab too (a bingo save, a reload). Follow it
  // while nothing is being edited; never overwrite unsaved input.
  useEffect(() => {
    if (!dirtyRef.current) setDraft(baseline);
  }, [baseline]);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useUnsavedChanges(dirty);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setSavedNote(false);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const isClanVsClan = event.mode === "clan_vs_clan";

  const save = () => {
    if (!draft.name.trim()) return;
    // Board-game events are refused a schedule (their turn timers keep running
    // between windows), so send null and a kind change clears any stored rule.
    const schedule =
      event.kind === "board_game" || event.kind === "conquest" ? null : draft.schedule;
    if (schedule) {
      const problem = materializeSchedule(
        schedule.rule,
        toUnix(draft.startsAt),
        toUnix(draft.endsAt),
      ).error;
      if (problem) {
        setError(problem);
        return;
      }
    }
    // Switching to free-for-all splits every shared team into one team per
    // player (server-side, ledger re-folded per player), which can't be undone.
    const sharedTeams = teams.filter((t) => (t.member_count ?? t.members?.length ?? 0) > 1);
    if (
      draft.formationMode === "solo" &&
      event.formation_mode !== "solo" &&
      sharedTeams.length > 0 &&
      !window.confirm(
        `Make this event a free-for-all? ${sharedTeams.length === 1 ? "Its team" : `Its ${sharedTeams.length} teams`} will be split so every player is a team of their own, keeping their own progress and points. This can't be undone.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      setError(null);
      try {
        const res = await updateGroupEvent(groupId, event.id, {
          name: draft.name,
          description: draft.description || undefined,
          starts_at: toUnix(draft.startsAt),
          ends_at: toUnix(draft.endsAt),
          schedule,
          formation_mode: draft.formationMode,
          join_code: draft.joinCode.trim() || null,
          visibility: draft.isPrivate ? "private" : "public",
          requires_confirmation: draft.requiresConfirmation,
          allow_live_edits: draft.allowLiveEdits,
          effort_visibility: draft.effortVisibility,
          tasks_visibility: draft.tasksVisibility,
          allow_late_signups: draft.allowLateSignups,
          submission_policy: draft.submissionPolicy,
          leadership: {
            enabled: draft.leadershipEnabled,
            co_leaders: draft.coLeaders,
            selection: draft.leaderSelection,
          },
        });
        const { event: updated } = unwrapActionResult(res);
        // Adopt the server's view now, so the baseline effect doesn't wait a
        // render with the stale event and flag the fresh draft as dirty.
        setDraft(draftFromEvent(updated));
        setSavedNote(true);
        onSaved(updated);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save the event. Please try again."));
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="heading-rule text-osrs-gold pb-1 text-lg font-semibold">General setup</h3>
      </div>
      {error && <Alert variant="error">{error}</Alert>}

      <Section title="Basics">
        <label className="block text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Event name</span>
          <input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Event name"
            aria-invalid={!draft.name.trim() || undefined}
            className={field}
          />
        </label>
        <label className="block text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
            Description (optional)
          </span>
          <textarea
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            className={field}
          />
        </label>
      </Section>

      <Section
        title="Schedule"
        hint="When the event runs. A draft with a start date goes live on its own at that time."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Starts</span>
            <input
              type="datetime-local"
              value={draft.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
              className={field}
            />
          </label>
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Ends</span>
            <input
              type="datetime-local"
              value={draft.endsAt}
              onChange={(e) => set("endsAt", e.target.value)}
              className={field}
            />
          </label>
        </div>
        <TimezoneNote className="text-osrs-parchment-dark/60 block text-xs" />
        {/* Recurring windows (web82a): the same builder the setup wizard
            uses; elapsed windows on a live event are frozen server-side. */}
        <EventScheduleBuilder
          value={draft.schedule}
          onChange={(schedule) => set("schedule", schedule)}
          startsAt={toUnix(draft.startsAt)}
          endsAt={toUnix(draft.endsAt)}
          kind={event.kind}
          status={event.status}
        />
      </Section>

      <Section title="Teams and sign-ups">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Team formation</span>
            <select
              value={draft.formationMode}
              onChange={(e) =>
                set("formationMode", e.target.value as EventDetail["formation_mode"])
              }
              className={field}
            >
              {EVENT_FORMATION_MODES.filter(
                (m) =>
                  m !== "solo" ||
                  event.formation_mode === "solo" ||
                  soloAllowed(event.kind, event.mode),
              ).map((m) => (
                <option key={m} value={m}>
                  {FORMATION_MODE_LABELS[m]}
                </option>
              ))}
            </select>
            {draft.formationMode === "solo" && (
              <span className="text-osrs-parchment-dark/60 mt-1 block text-xs">
                {FORMATION_MODE_HELP.solo}
              </span>
            )}
          </label>
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
              Join code (self join only, blank for open sign-up)
            </span>
            <input
              value={draft.joinCode}
              onChange={(e) => set("joinCode", e.target.value)}
              maxLength={32}
              placeholder="Optional code players must enter"
              className={field}
            />
          </label>
        </div>
        {draft.formationMode !== "admin_assign" && (
          <Check
            checked={draft.allowLateSignups}
            onChange={(v) => set("allowLateSignups", v)}
            label="Keep sign-ups open after the event starts"
            help="Off by default: sign-ups close when the event begins and the Discord sign-up post drops its button. Turn this on to let latecomers join mid-event. You can still add players by hand either way."
          />
        )}

        {/* Team leadership (web48a): leaders hold executive authority. On
            board-game events they trigger the rolls and run the shop. */}
        <fieldset className="border-osrs-bronze/20 space-y-3 rounded border p-3">
          <legend className="text-osrs-parchment-dark/70 px-1 text-xs">Team leadership</legend>
          <Check
            checked={draft.leadershipEnabled}
            onChange={(v) => set("leadershipEnabled", v)}
            label="Teams have a leader"
            help={
              <>
                The leader makes the executive calls for their team. On board-game events only
                they can trigger dice rolls and buy or use shop items. Pick each team&apos;s leader
                on the Teams tab.
              </>
            }
          />
          {draft.leadershipEnabled && (
            <>
              <Check
                checked={draft.coLeaders}
                onChange={(v) => set("coLeaders", v)}
                label="Allow a co-leader"
                help={<>Shares the leader&apos;s authority; the leader can appoint their own.</>}
              />
              <label className="block text-sm sm:max-w-xs">
                <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                  How leaders are chosen
                </span>
                <select
                  value={draft.leaderSelection}
                  onChange={(e) =>
                    set("leaderSelection", e.target.value as "admin" | "election")
                  }
                  className={field}
                >
                  <option value="admin">Admins assign leaders</option>
                  <option value="election">Teams elect their leader (majority vote)</option>
                </select>
                <span className="text-osrs-parchment-dark/60 mt-1 block text-xs">
                  Admin assignment always works as an override, either way. Members vote on their
                  team&apos;s page.
                </span>
              </label>
            </>
          )}
        </fieldset>
      </Section>

      <Section title="Submissions and review">
        <label className="block text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Submission policy</span>
          <select
            value={draft.submissionPolicy}
            onChange={(e) =>
              set("submissionPolicy", e.target.value as EventDetail["submission_policy"])
            }
            className={field}
          >
            {EVENT_SUBMISSION_POLICIES.map((p) => (
              <option key={p} value={p}>
                {SUBMISSION_POLICY_LABELS[p]}
              </option>
            ))}
          </select>
          <span className="text-osrs-parchment-dark/60 mt-1 block text-xs">
            {SUBMISSION_POLICY_HELP[draft.submissionPolicy]}
          </span>
        </label>
        <Check
          checked={draft.requiresConfirmation}
          onChange={(v) => set("requiresConfirmation", v)}
          label={
            <>
              Require manual confirmation for <em>every</em> completion
            </>
          }
          help="All automatic completions queue in Review until an admin confirms them. You can also require review per task on the Tasks tab."
        />
        <Check
          checked={draft.allowLiveEdits}
          onChange={(v) => set("allowLiveEdits", v)}
          label="Allow live edits after the event starts"
          help="Keeps the bingo board editable while the event runs. Tasks and teams are always adjustable mid-event, and scoring changes ask whether to re-score existing progress. Every change is audited."
        />
      </Section>

      <Section title="Privacy and visibility">
        <Check
          checked={draft.isPrivate}
          onChange={(v) => set("isPrivate", v)}
          label="Keep this event private"
          help={`Hidden from the public events list and search. Only members of the ${isClanVsClan ? "participating clans" : "group"} and event admins can see it.`}
        />
        <Check
          checked={draft.tasksVisibility === "admins"}
          onChange={(v) => set("tasksVisibility", v ? "admins" : "public")}
          label="Hide the board and tasks from participants"
          help="Only event admins and event managers see the task list, the bingo board or game-board tiles, and the board images posted to Discord and shown in-game. Everyone else still sees the event, its teams and standings, and is told what they completed as it happens. Use it to play blind, or to keep a board under wraps until you un-tick it and reveal it."
        />
        <Check
          checked={draft.effortVisibility === "admins"}
          onChange={(v) => set("effortVisibility", v ? "admins" : "public")}
          label="Keep EHE private to event managers"
          help={
            <>
              EHE (Efficient Hours towards Event) estimates how long each player spent working on
              this event&apos;s tasks. It stays on the team and player pages by default; tick this
              to confine it to your effort report, which some clans prefer since a public
              per-member effort column can read as &ldquo;here&apos;s who did the least&rdquo;.
              Effort is recorded either way, so you can un-tick it later and the full history
              appears.
            </>
          }
        />
      </Section>

      <div className="border-osrs-bronze/30 bg-osrs-brown-dark/95 sticky bottom-0 z-20 flex flex-wrap items-center gap-3 rounded border px-4 py-3">
        <span
          className={`text-sm ${dirty ? "text-osrs-gold-bright" : "text-osrs-parchment-dark/60"}`}
          role="status"
        >
          {dirty ? "Unsaved changes" : savedNote ? "Saved" : "No unsaved changes"}
        </span>
        {!draft.name.trim() && (
          <span className="text-osrs-red text-xs">The event needs a name.</span>
        )}
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(baseline);
              setError(null);
            }}
            disabled={pending || !dirty}
            className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm disabled:opacity-40"
          >
            Discard
          </button>
          <Button
            variant="primary"
            size="sm"
            onClick={save}
            disabled={pending || !dirty || !draft.name.trim()}
          >
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </span>
      </div>
    </div>
  );
}
