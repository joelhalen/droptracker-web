"use client";

/**
 * Guided event setup — a step-by-step wizard that replaces the old
 * single-page create form. Design goals (suggestion "wizard-type new event"):
 *
 *  - Walk through one decision at a time, with concise inline help
 *    (HelpTips + one-line blurbs) instead of essays.
 *  - Nothing is mandatory up front: the draft is created after the Schedule
 *    step, every later step can be skipped, and "Save & exit" is always
 *    available — the draft keeps whatever was configured so far and the
 *    wizard resumes via ?event={id}.
 *  - Review & launch pre-flights the same readiness checks as activation and
 *    links each blocker back to the step that fixes it.
 *
 * The full event manager remains the power surface; the wizard reuses its
 * server actions and embeds the same task form / library picker / board
 * designers, so anything configured here is the real thing, not a copy.
 */
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  EVENT_MODES,
  EVENT_SUBMISSION_POLICIES,
  EVENT_FORMATION_MODES,
  EVENT_PRIZE_DISTRIBUTIONS,
  type DiscordRole,
  type EventDetail,
  type EventDiscordPolicy,
  type EventKind,
  type EventKindMeta,
  type EventParticipant,
  type EventPrizeDistribution,
  type EventReadiness,
  type EventTask,
  type EventTeam,
  type EventTeamBulkAddResult,
} from "@droptracker/api-types";
import {
  activateEvent,
  addEventTeam,
  addEventTeamMember,
  bulkAddEventTeamMembers,
  checkEventReadiness,
  createGroupEvent,
  deleteEventTeam,
  fetchEventKinds,
  listEventParticipants,
  reloadGroupEvent,
  removeEventTask,
  removeEventTeamMember,
  searchParticipantPlayers,
  updateEventPotConfig,
  updateGroupEvent,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";
import { fetchDiscordRoles } from "@/app/(site)/(admin)/groups/[id]/announcements/actions";
import { getErrorMessage } from "@/lib/errors";
import {
  EVENT_MODE_LABELS,
  FORMATION_MODE_HELP,
  FORMATION_MODE_LABELS,
  SUBMISSION_POLICY_HELP,
  SUBMISSION_POLICY_LABELS,
  TASK_TYPE_LABELS,
  taskGoal,
  teamColorMap,
} from "@/lib/events";
import { Alert, EmptyState } from "@/components/ui";
import { DiscordRolePicker } from "@/components/discord-role-picker";
import { EventBingoDesigner } from "@/components/event-bingo-designer";
import { EventBoardDesigner } from "@/components/event-board-designer";
import { EventDiscordSettings } from "@/components/event-discord";
import { EventParticipantsPanel } from "@/components/event-participants-panel";
import { EventTaskForm } from "@/components/event-task-form";
import { EventTaskLibraryPicker } from "@/components/event-task-library-picker";
import { HelpTip } from "@/components/help-tip";
import { LocalTime, TimezoneNote } from "@/components/local-time";
import { PlayerAddInput } from "@/components/player-add-input";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";
const primaryBtn =
  "bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50";
const ghostBtn =
  "border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-4 py-2 text-sm disabled:opacity-50";

/** Unix seconds → a datetime-local input value in the viewer's timezone. */
function toLocalInput(unix: number | null | undefined): string {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

const toUnix = (v: string): number | null => (v ? Math.floor(new Date(v).getTime() / 1000) : null);

type StepKey = "basics" | "schedule" | "rules" | "tasks" | "teams" | "discord" | "review";

const STEPS: { key: StepKey; label: string; blurb: string; docs?: string }[] = [
  {
    key: "basics",
    label: "Basics",
    blurb: "Name the event and pick its format. Everything here can change while it's a draft.",
    docs: "/docs/events-create",
  },
  {
    key: "schedule",
    label: "Schedule",
    blurb:
      "When it runs. Dates are optional for now — a draft with a start time goes live on its own.",
    docs: "/docs/events-create",
  },
  {
    key: "rules",
    label: "Joining & rules",
    blurb: "How players get onto teams, and which submissions count.",
    docs: "/docs/events-players",
  },
  {
    key: "tasks",
    label: "Tasks & board",
    blurb: "What players compete on. Add a few now or skip and build the list later.",
    docs: "/docs/events-tasks",
  },
  {
    key: "teams",
    label: "Teams & players",
    blurb: "Who's competing. Type a name for live suggestions, or paste a whole comma-separated list.",
    docs: "/docs/events-teams",
  },
  {
    key: "discord",
    label: "Discord",
    blurb:
      "Where announcements and completion messages go. Defaults to your clan's linked server — skip if that's fine.",
    docs: "/docs/events-discord",
  },
  {
    key: "review",
    label: "Review & launch",
    blurb: "A pre-flight of the launch checks. Launch now, or keep it as a draft.",
    docs: "/docs/events-create",
  },
];

/** Readiness blocker target → wizard step that fixes it. */
const BLOCKER_STEP: Record<string, StepKey> = {
  dates: "schedule",
  tasks: "tasks",
  board: "tasks",
  teams: "teams",
};

export function EventSetupWizard({
  groupId,
  initialEvent = null,
}: {
  groupId: number | null;
  /** Resume an existing draft (?event={id}); null starts fresh. */
  initialEvent?: EventDetail | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);

  // The real draft, once it exists. Before that the wizard buffers locally.
  const [detail, setDetail] = useState<EventDetail | null>(initialEvent);

  // Step 1–3 fields (seeded from the draft when resuming).
  const [name, setName] = useState(initialEvent?.name ?? "");
  const [description, setDescription] = useState(initialEvent?.description ?? "");
  const [kind, setKind] = useState<EventKind>(initialEvent?.kind ?? "standard");
  const [mode, setMode] = useState<(typeof EVENT_MODES)[number]>(initialEvent?.mode ?? "standard");
  const [startsAt, setStartsAt] = useState(toLocalInput(initialEvent?.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(initialEvent?.ends_at));
  const [discordPolicy, setDiscordPolicy] = useState<EventDiscordPolicy>("on_activate");
  const [pingRoleIds, setPingRoleIds] = useState<string[]>([]);
  const [formationMode, setFormationMode] = useState<EventDetail["formation_mode"]>(
    initialEvent?.formation_mode ?? "admin_assign",
  );
  const [joinCode, setJoinCode] = useState(initialEvent?.join_code ?? "");
  const [submissionPolicy, setSubmissionPolicy] = useState<EventDetail["submission_policy"]>(
    initialEvent?.submission_policy ?? "all",
  );
  const [requiresConfirmation, setRequiresConfirmation] = useState(
    initialEvent?.requires_confirmation ?? false,
  );
  // Prize pot (web52a): optional, configured on the "Joining & rules" step and
  // refined later in the manager's Prize Pot tab.
  const [potEnabled, setPotEnabled] = useState(initialEvent?.prize_pot?.enabled ?? false);
  const [potDefaultBuyin, setPotDefaultBuyin] = useState(0);
  const [potDistribution, setPotDistribution] = useState<EventPrizeDistribution>(
    initialEvent?.prize_pot?.distribution ?? "first_only",
  );
  const [potAdvertise, setPotAdvertise] = useState(initialEvent?.prize_pot?.advertise ?? false);

  const [kinds, setKinds] = useState<EventKindMeta[] | null>(null);
  const [roles, setRoles] = useState<DiscordRole[] | null>(null);
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [readiness, setReadiness] = useState<EventReadiness | null>(null);
  const [checkingReadiness, setCheckingReadiness] = useState(false);

  const step = STEPS[stepIdx]!;
  const managerPath = (id: number) =>
    (groupId == null ? `/admin/events/${id}` : `/groups/${groupId}/events/${id}`) as Route;

  // Kind registry (same fallback behavior as the old create form).
  useEffect(() => {
    let cancelled = false;
    fetchEventKinds(groupId)
      .then((rows) => !cancelled && setKinds(rows))
      .catch(() => !cancelled && setKinds(null));
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  // Ping-role picker roles — only needed before the draft exists (pings are
  // part of the create payload). The bot warms a cold cache in ~15s.
  useEffect(() => {
    if (groupId == null || detail != null) return;
    let cancelled = false;
    let retried = false;
    const load = () => {
      fetchDiscordRoles(groupId)
        .then((r) => {
          if (cancelled) return;
          setRoles(r.roles);
          if (r.stale && !retried) {
            retried = true;
            setTimeout(load, 16_000);
          }
        })
        .catch(() => !cancelled && setRoles([]));
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [groupId, detail == null]);

  // Accepted-participant clans (clan-vs-clan): powers the team→clan select.
  // Refreshed when entering the Teams step (invites may have just happened).
  useEffect(() => {
    if (!detail || detail.mode !== "clan_vs_clan" || step.key !== "teams") return;
    let cancelled = false;
    listEventParticipants(groupId, detail.id)
      .then((rows) => !cancelled && setParticipants(rows))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [detail?.id, detail?.mode, step.key]);

  // Pre-flight the launch checks whenever Review is opened.
  useEffect(() => {
    if (step.key !== "review" || !detail) return;
    let cancelled = false;
    setCheckingReadiness(true);
    checkEventReadiness(groupId, detail.id)
      .then((r) => !cancelled && setReadiness(r))
      .catch(() => !cancelled && setReadiness(null))
      .finally(() => !cancelled && setCheckingReadiness(false));
    return () => {
      cancelled = true;
    };
  }, [step.key, detail?.id]);

  const gotoStep = (idx: number) => {
    // Later steps need the draft to exist; earlier steps are always fine.
    if (idx > 1 && !detail) return;
    setError(null);
    setStepIdx(idx);
  };

  /** Steps 1–2 commit basics/schedule; the draft is created on leaving
   * Schedule. Later steps write immediately via their own actions. */
  const onContinue = () =>
    startTransition(async () => {
      setError(null);
      try {
        if (step.key === "basics") {
          if (!name.trim()) {
            setError("Give the event a name first.");
            return;
          }
          if (detail) {
            // An empty description clears it (the backend stores "" as NULL).
            await updateGroupEvent(groupId, detail.id, {
              name: name.trim(),
              description,
              ...(kind !== detail.kind ? { kind } : {}),
              ...(groupId != null && mode !== detail.mode ? { mode } : {}),
            });
            setDetail({ ...detail, name: name.trim(), description: description || null, kind, mode });
          }
        } else if (step.key === "schedule") {
          if (!detail) {
            const res = await createGroupEvent(groupId, {
              name: name.trim(),
              description: description || undefined,
              starts_at: toUnix(startsAt),
              ends_at: toUnix(endsAt),
              ...(groupId != null ? { mode } : {}),
              kind,
              discord_event_policy: discordPolicy,
              ...(pingRoleIds.length ? { pings: { event_created: pingRoleIds } } : {}),
            });
            const full = await reloadGroupEvent(groupId, res.id);
            setDetail(full);
            // Make refresh/back resume this draft without an RSC roundtrip
            // (a router.replace would re-render the page mid-wizard).
            window.history.replaceState(null, "", `?event=${res.id}`);
          } else {
            await updateGroupEvent(groupId, detail.id, {
              starts_at: toUnix(startsAt),
              ends_at: toUnix(endsAt),
            });
            setDetail({ ...detail, starts_at: toUnix(startsAt), ends_at: toUnix(endsAt) });
          }
        } else if (step.key === "rules" && detail) {
          await updateGroupEvent(groupId, detail.id, {
            formation_mode: formationMode,
            join_code: formationMode === "self_join" ? joinCode.trim() || null : null,
            submission_policy: submissionPolicy,
            requires_confirmation: requiresConfirmation,
          });
          // Prize pot config rides its own action (not part of EventInput).
          // confirm_disable_buyins is safe here — a wizard draft has no records.
          const potRes = await updateEventPotConfig(groupId, detail.id, {
            buyins_enabled: potEnabled,
            confirm_disable_buyins: true,
            prize_config: {
              default_buyin: potDefaultBuyin,
              distribution: potDistribution,
              advertise: potAdvertise,
            },
          });
          setDetail(
            potRes.ok
              ? potRes.event
              : {
                  ...detail,
                  formation_mode: formationMode,
                  submission_policy: submissionPolicy,
                  requires_confirmation: requiresConfirmation,
                },
          );
        }
        setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save this step. Please try again."));
      }
    });

  const onActivate = () =>
    startTransition(async () => {
      if (!detail) return;
      setError(null);
      const res = await activateEvent(groupId, detail.id);
      if (res.ok) {
        router.push(managerPath(detail.id));
      } else {
        setError(res.message);
        if (res.blockers.length) {
          setReadiness((r) => (r ? { ...r, ready: false, blockers: res.blockers } : r));
        }
      }
    });

  // ---- Task/team state helpers (mirror the manager's optimistic updates) ---

  const applyDetail = (d: EventDetail) => setDetail(d);
  const tasks = detail?.tasks ?? [];
  const teams = detail?.teams ?? [];

  const patchTeams = (fn: (teams: EventTeam[]) => EventTeam[]) =>
    setDetail((d) => (d ? { ...d, teams: fn(d.teams) } : d));

  const onTaskSaved = (task: EventTask) =>
    setDetail((d) =>
      d
        ? {
            ...d,
            tasks: d.tasks.some((t) => t.id === task.id)
              ? d.tasks.map((t) => (t.id === task.id ? task : t))
              : [...d.tasks, task],
          }
        : d,
    );

  const onRemoveTask = (taskId: number) =>
    startTransition(async () => {
      if (!detail) return;
      setError(null);
      try {
        await removeEventTask(groupId, detail.id, taskId);
        setDetail((d) => (d ? { ...d, tasks: d.tasks.filter((t) => t.id !== taskId) } : d));
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't remove the task."));
      }
    });

  const onPickMember = (teamId: number, player: { id: number; name: string }) =>
    startTransition(async () => {
      if (!detail) return;
      setError(null);
      try {
        await addEventTeamMember(groupId, detail.id, teamId, player.id);
        const joinedAt = Math.floor(Date.now() / 1000);
        patchTeams((prev) =>
          prev.map((t) => {
            const members = (t.members ?? []).filter((m) => m.player_id !== player.id);
            if (t.id === teamId) {
              members.push({
                player_id: player.id,
                player_name: player.name,
                joined_at: joinedAt,
              });
            }
            return { ...t, members, member_count: members.length };
          }),
        );
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't add the player."));
      }
    });

  const onBulkAddMembers = async (
    teamId: number,
    names: string[],
  ): Promise<EventTeamBulkAddResult> => {
    if (!detail) return { added: [], skipped: [] };
    const result = await bulkAddEventTeamMembers(groupId, detail.id, teamId, names);
    if (result.added.length) {
      const joinedAt = Math.floor(Date.now() / 1000);
      patchTeams((prev) =>
        prev.map((t) => {
          if (t.id !== teamId) return t;
          const members = [...(t.members ?? [])];
          for (const p of result.added) {
            if (!members.some((m) => m.player_id === p.id)) {
              members.push({ player_id: p.id, player_name: p.name, joined_at: joinedAt });
            }
          }
          return { ...t, members, member_count: members.length };
        }),
      );
    }
    return result;
  };

  const onRemoveMember = (teamId: number, playerId: number) =>
    startTransition(async () => {
      if (!detail) return;
      setError(null);
      try {
        await removeEventTeamMember(groupId, detail.id, teamId, playerId);
        patchTeams((prev) =>
          prev.map((t) => {
            if (t.id !== teamId) return t;
            const members = (t.members ?? []).filter((m) => m.player_id !== playerId);
            return { ...t, members, member_count: members.length };
          }),
        );
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't remove the player."));
      }
    });

  const onDeleteTeam = (teamId: number) =>
    startTransition(async () => {
      if (!detail) return;
      setError(null);
      try {
        await deleteEventTeam(groupId, detail.id, teamId);
        patchTeams((prev) => prev.filter((t) => t.id !== teamId));
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't delete the team."));
      }
    });

  const acceptedParticipants = participants.filter((p) => p.status === "accepted");
  const acceptedIds = acceptedParticipants.map((p) => p.group_id);
  const isClanVsClan = (detail?.mode ?? mode) === "clan_vs_clan";
  const isLastStep = stepIdx === STEPS.length - 1;

  return (
    <div className="space-y-5">
      {/* Progress rail */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ol className="flex flex-wrap gap-1.5 text-xs">
          {STEPS.map((s, i) => {
            const reachable = i <= 1 || detail != null;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => gotoStep(i)}
                  disabled={!reachable || pending}
                  className={`rounded px-2 py-1 ${
                    stepIdx === i
                      ? "bg-osrs-bronze text-osrs-parchment"
                      : i < stepIdx
                        ? "text-osrs-green hover:text-osrs-gold-bright"
                        : reachable
                          ? "text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
                          : "text-osrs-parchment-dark/30"
                  } disabled:cursor-default`}
                >
                  {i + 1}. {s.label}
                </button>
              </li>
            );
          })}
        </ol>
        {detail && (
          <Link
            href={managerPath(detail.id)}
            className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-xs"
          >
            Save &amp; exit — finish later →
          </Link>
        )}
      </div>

      {/* Step header: one line of context, never an essay. */}
      <div>
        <h3 className="text-osrs-gold text-lg font-semibold">{step.label}</h3>
        <p className="text-osrs-parchment-dark/60 mt-0.5 text-sm">
          {step.blurb}
          {step.docs && (
            <>
              {" "}
              <Link
                href={step.docs as Route}
                className="text-osrs-gold/80 hover:text-osrs-gold-bright"
              >
                Docs ↗
              </Link>
            </>
          )}
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* ---- Step 1: Basics -------------------------------------------- */}
      {step.key === "basics" && (
        <div className="max-w-2xl space-y-3">
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Event name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Winter Bingo 2026"'
              maxLength={120}
              className={field}
            />
          </label>
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
              Description (optional)
            </span>
            <textarea
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Shown on the public event page."
              rows={2}
              className={field}
            />
          </label>
          {kinds && kinds.length > 0 && (
            <div className="text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                Format
                <HelpTip title="Format" docsHref="/docs/events-create">
                  <p>
                    The game players see: a plain task list, a bingo board, or a dice board game.
                    You can still switch while the event is a draft.
                  </p>
                </HelpTip>
              </span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup">
                {kinds.map((k) => {
                  const selected = kind === k.key;
                  return (
                    <button
                      key={k.key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!k.creatable}
                      onClick={() => k.creatable && setKind(k.key)}
                      className={`rounded border p-2.5 text-left ${
                        selected
                          ? "border-osrs-gold bg-osrs-brown-dark/60"
                          : "border-osrs-bronze/30 bg-osrs-brown-dark/30"
                      } ${
                        k.creatable
                          ? "hover:border-osrs-gold/70 cursor-pointer"
                          : "cursor-not-allowed opacity-50"
                      }`}
                    >
                      <span className="text-osrs-parchment block text-sm font-medium">
                        {k.label}
                        {!k.creatable && (
                          <span className="text-osrs-parchment-dark/60 ml-1.5 text-[10px] uppercase tracking-wide">
                            {k.admin_only ? "staff testing" : "unavailable"}
                          </span>
                        )}
                      </span>
                      {k.description && (
                        <span className="text-osrs-parchment-dark/60 mt-0.5 block text-xs">
                          {k.description}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {groupId != null && (
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                Ownership
                <HelpTip title="Ownership" docsHref="/docs/events-teams">
                  <p>
                    <strong>Standard</strong>: your clan competes among itself.{" "}
                    <strong>Clan vs clan</strong>: you host and challenge another clan — you invite
                    the opponent after this wizard&apos;s Teams step.
                  </p>
                </HelpTip>
              </span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as (typeof EVENT_MODES)[number])}
                disabled={detail != null && teams.length > 0}
                className={field}
              >
                {EVENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {EVENT_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
              {detail != null && teams.length > 0 && (
                <p className="text-osrs-parchment-dark/50 mt-1 text-xs">
                  Remove the event&apos;s teams before changing ownership.
                </p>
              )}
            </label>
          )}
        </div>
      )}

      {/* ---- Step 2: Schedule ------------------------------------------ */}
      {step.key === "schedule" && (
        <div className="max-w-2xl space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                Starts
                <HelpTip title="Start time">
                  <p>
                    Optional for now. A draft with a start time goes live automatically when it
                    arrives; without one, you launch it by hand from Review.
                  </p>
                </HelpTip>
              </span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={field}
              />
            </label>
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                Ends
                <HelpTip title="End time">
                  <p>
                    Required before launch — events end automatically at this time and final
                    standings are announced.
                  </p>
                </HelpTip>
              </span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={field}
              />
            </label>
          </div>
          <TimezoneNote className="text-osrs-parchment-dark/60 block text-xs" />

          {!detail && (
            <fieldset className="border-osrs-bronze/20 space-y-2 rounded border p-3">
              <legend className="text-osrs-gold px-1 text-sm font-semibold">
                Discord announcement
              </legend>
              <p className="text-osrs-parchment-dark/60 text-xs">
                A matching Discord scheduled event is created on the event&apos;s server
                {groupId != null ? " (your clan's linked server by default)" : ""}. When should it
                appear?
              </p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="wizard-discord-policy"
                  checked={discordPolicy === "on_activate"}
                  onChange={() => setDiscordPolicy("on_activate")}
                  className="mt-0.5"
                />
                <span>
                  When the event goes live
                  <span className="text-osrs-parchment-dark/50 block text-xs">
                    Nothing is posted to Discord while this is still a draft (recommended).
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="wizard-discord-policy"
                  checked={discordPolicy === "immediate"}
                  onChange={() => setDiscordPolicy("immediate")}
                  className="mt-0.5"
                />
                <span>
                  Right away
                  <span className="text-osrs-parchment-dark/50 block text-xs">
                    Creates the Discord event immediately, even while you&apos;re still drafting.
                  </span>
                </span>
              </label>
              {groupId != null && (
                <div className="pt-1">
                  <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                    Ping these roles when the Discord event is created
                  </span>
                  <DiscordRolePicker
                    roles={roles}
                    selected={pingRoleIds}
                    onToggle={(id) =>
                      setPingRoleIds((prev) =>
                        prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
                      )
                    }
                  />
                </div>
              )}
            </fieldset>
          )}
          {!detail && (
            <p className="text-osrs-parchment-dark/50 text-xs">
              Continuing creates the event as a <strong>draft</strong> — nothing goes live and you
              can stop and come back at any point.
            </p>
          )}
        </div>
      )}

      {/* ---- Step 3: Joining & rules ------------------------------------ */}
      {step.key === "rules" && detail && (
        <div className="max-w-2xl space-y-4">
          <div className="text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
              How do players get onto teams?
            </span>
            <div className="space-y-2" role="radiogroup">
              {EVENT_FORMATION_MODES.map((m) => (
                <label
                  key={m}
                  className={`flex cursor-pointer items-start gap-2 rounded border p-2.5 ${
                    formationMode === m
                      ? "border-osrs-gold bg-osrs-brown-dark/60"
                      : "border-osrs-bronze/30 bg-osrs-brown-dark/30 hover:border-osrs-gold/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="wizard-formation"
                    checked={formationMode === m}
                    onChange={() => setFormationMode(m)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="text-osrs-parchment block text-sm font-medium">
                      {FORMATION_MODE_LABELS[m]}
                    </span>
                    <span className="text-osrs-parchment-dark/60 block text-xs">
                      {FORMATION_MODE_HELP[m]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          {formationMode === "self_join" && (
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                Join code (optional)
                <HelpTip title="Join code">
                  <p>
                    When set, players must enter this code to sign themselves up — handy for
                    keeping an event to people who saw the announcement.
                  </p>
                </HelpTip>
              </span>
              <input
                value={joinCode ?? ""}
                onChange={(e) => setJoinCode(e.target.value)}
                maxLength={32}
                placeholder="Leave empty for open sign-up"
                className={`${field} max-w-xs`}
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
              Which submissions count?
            </span>
            <select
              value={submissionPolicy}
              onChange={(e) =>
                setSubmissionPolicy(e.target.value as EventDetail["submission_policy"])
              }
              className={`${field} max-w-md`}
            >
              {EVENT_SUBMISSION_POLICIES.map((p) => (
                <option key={p} value={p}>
                  {SUBMISSION_POLICY_LABELS[p]}
                </option>
              ))}
            </select>
            <span className="text-osrs-parchment-dark/50 mt-1 block text-xs">
              {SUBMISSION_POLICY_HELP[submissionPolicy]}
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={requiresConfirmation}
              onChange={(e) => setRequiresConfirmation(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Every completion needs admin review
              <span className="text-osrs-parchment-dark/50 block text-xs">
                Completions queue in Review instead of counting instantly. You can also set this
                per task — leave it off unless you want to check everything by hand.
              </span>
            </span>
          </label>

          {/* Prize pot (web52a): optional GP buy-in / donation tracking. Fine
              details (the roster tick, donations, custom split) live in the
              manager's Prize Pot tab once the event exists. */}
          <div className="border-osrs-bronze/20 space-y-3 rounded border border-dashed p-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={potEnabled}
                onChange={(e) => setPotEnabled(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                💰 Track a prize pot (buy-ins &amp; donations)
                <span className="text-osrs-parchment-dark/50 block text-xs">
                  Record GP buy-ins and donations and advertise a running pot. The tool tracks and
                  advertises GP only — payouts are still traded in-game, like split-tracking.
                </span>
              </span>
            </label>
            {potEnabled && (
              <div className="space-y-3 pl-6">
                <label className="block text-sm">
                  <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                    Default buy-in (GP) — 0 for no fixed stake
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={potDefaultBuyin || ""}
                    onChange={(e) => setPotDefaultBuyin(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="0"
                    className={`${field} max-w-[12rem]`}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                    Who wins the pot?
                  </span>
                  <select
                    value={potDistribution}
                    onChange={(e) => setPotDistribution(e.target.value as EventPrizeDistribution)}
                    className={`${field} max-w-md`}
                  >
                    {EVENT_PRIZE_DISTRIBUTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d === "first_only"
                          ? "Winner takes all"
                          : d === "top_n"
                            ? "Top teams split it (set count later)"
                            : "Custom split (configure later)"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={potAdvertise}
                    onChange={(e) => setPotAdvertise(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Advertise the pot on Discord
                    <span className="text-osrs-parchment-dark/50 block text-xs">
                      Shows a running pot total on the standings board and start/end announcements.
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Step 4: Tasks & board -------------------------------------- */}
      {step.key === "tasks" && detail && (
        <WizardTasksStep
          groupId={groupId}
          detail={detail}
          tasks={tasks}
          pending={pending}
          onTaskSaved={onTaskSaved}
          onRemoveTask={onRemoveTask}
          onDetail={applyDetail}
        />
      )}

      {/* ---- Step 5: Teams & players ------------------------------------ */}
      {step.key === "teams" && detail && (
        <div className="space-y-4">
          {isClanVsClan && groupId != null && (
            <>
              <EventParticipantsPanel
                groupId={groupId}
                eventId={detail.id}
                isHost={detail.group_id === groupId}
              />
              <p className="text-osrs-parchment-dark/60 text-sm">
                Teams are optional for clan-vs-clan: leave them out and the event runs whole clan
                vs whole clan automatically. Add teams only to split clans into named squads.
              </p>
            </>
          )}
          <WizardTeamsStep
            groupId={groupId}
            detail={detail}
            teams={teams}
            participants={acceptedParticipants}
            participantGroupIds={
              isClanVsClan ? acceptedIds : groupId != null ? [groupId] : []
            }
            pending={pending}
            formationMode={formationMode}
            onAddTeam={async (teamName, clanId) => {
              const res = await addEventTeam(groupId, detail.id, {
                name: teamName,
                ...(clanId != null ? { group_id: clanId } : {}),
              });
              patchTeams((prev) => [
                ...prev,
                {
                  id: res.id,
                  name: teamName,
                  score: 0,
                  member_count: 0,
                  group_id: clanId ?? null,
                  color: null,
                  coins: 0,
                  piece_item_id: null,
                  members: [],
                },
              ]);
            }}
            onPickMember={onPickMember}
            onBulkAdd={onBulkAddMembers}
            onRemoveMember={onRemoveMember}
            onDeleteTeam={onDeleteTeam}
          />
        </div>
      )}

      {/* ---- Step 6: Discord --------------------------------------------- */}
      {step.key === "discord" && detail && (
        <EventDiscordSettings groupId={groupId} eventId={detail.id} />
      )}

      {/* ---- Step 7: Review & launch ------------------------------------- */}
      {step.key === "review" && detail && (
        <div className="max-w-2xl space-y-4">
          <dl className="border-osrs-bronze/20 divide-osrs-bronze/10 divide-y rounded border text-sm">
            {(
              [
                ["Name", detail.name],
                [
                  "Format",
                  kinds?.find((k) => k.key === detail.kind)?.label ?? detail.kind,
                ],
                ...(groupId != null ? [["Ownership", EVENT_MODE_LABELS[detail.mode]]] : []),
                [
                  "Starts",
                  detail.starts_at ? (
                    <LocalTime key="s" unix={detail.starts_at} />
                  ) : (
                    "manual launch"
                  ),
                ],
                [
                  "Ends",
                  detail.ends_at ? <LocalTime key="e" unix={detail.ends_at} /> : "not set",
                ],
                ["Joining", FORMATION_MODE_LABELS[detail.formation_mode]],
                ["Submissions", SUBMISSION_POLICY_LABELS[detail.submission_policy]],
                ["Tasks", String(tasks.length)],
                [
                  "Teams",
                  teams.length
                    ? `${teams.length} (${teams.reduce((n, t) => n + (t.members?.length ?? t.member_count), 0)} players)`
                    : isClanVsClan
                      ? "whole clan vs whole clan"
                      : "none yet",
                ],
              ] as [string, ReactNode][]
            ).map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 px-3 py-2">
                <dt className="text-osrs-parchment-dark/60 text-xs">{label}</dt>
                <dd className="text-osrs-parchment/90 text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          {checkingReadiness ? (
            <p className="text-osrs-parchment-dark/60 text-sm">Checking launch readiness…</p>
          ) : readiness && !readiness.ready ? (
            <div className="border-osrs-red/30 bg-osrs-red/5 rounded border p-3 text-sm">
              <p className="text-osrs-parchment/90 mb-2 font-medium">
                A few things before this can launch:
              </p>
              <ul className="space-y-1.5">
                {readiness.blockers.map((b) => {
                  const target = BLOCKER_STEP[b.target];
                  const idx = target ? STEPS.findIndex((s) => s.key === target) : -1;
                  return (
                    <li key={b.code} className="flex items-center justify-between gap-2">
                      <span className="text-osrs-parchment-dark/80">{b.message}</span>
                      {idx >= 0 && (
                        <button
                          type="button"
                          onClick={() => gotoStep(idx)}
                          className="text-osrs-gold-bright shrink-0 text-xs hover:underline"
                        >
                          Fix →
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : readiness?.ready ? (
            <p className="text-osrs-green text-sm">
              ✓ Ready to launch.
              {readiness.auto_start &&
                " It will also go live on its own at the scheduled start time."}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onActivate}
              disabled={pending || checkingReadiness || !(readiness?.ready ?? false)}
              className={primaryBtn}
            >
              {pending ? "Launching…" : "Launch event now"}
            </button>
            <Link href={managerPath(detail.id)} className={ghostBtn}>
              Keep as draft — finish later
            </Link>
          </div>
          <p className="text-osrs-parchment-dark/50 text-xs">
            Either way, everything stays editable from the event manager — that&apos;s also where
            reviews, manual awards, and advanced team options live.
          </p>
        </div>
      )}

      {/* Footer nav (Review has its own actions). */}
      {!isLastStep && (
        <div className="border-osrs-bronze/20 flex items-center gap-2 border-t pt-4">
          {stepIdx > 0 && (
            <button
              type="button"
              onClick={() => gotoStep(stepIdx - 1)}
              disabled={pending}
              className="text-osrs-parchment-dark/70 hover:text-osrs-parchment rounded px-2 py-2 text-sm"
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            onClick={onContinue}
            disabled={pending || (step.key === "basics" && !name.trim())}
            className={primaryBtn}
          >
            {pending
              ? "Saving…"
              : step.key === "schedule" && !detail
                ? "Create draft & continue"
                : "Continue"}
          </button>
          {detail && step.key !== "basics" && step.key !== "schedule" && step.key !== "rules" && (
            <button
              type="button"
              onClick={() => gotoStep(stepIdx + 1)}
              disabled={pending}
              className="text-osrs-parchment-dark/60 hover:text-osrs-parchment rounded px-2 py-2 text-sm"
            >
              Skip for now
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

/** Tasks step: compact task list + the same task form / library picker /
 * board designers the manager uses. */
function WizardTasksStep({
  groupId,
  detail,
  tasks,
  pending,
  onTaskSaved,
  onRemoveTask,
  onDetail,
}: {
  groupId: number | null;
  detail: EventDetail;
  tasks: EventTask[];
  pending: boolean;
  onTaskSaved: (task: EventTask) => void;
  onRemoveTask: (taskId: number) => void;
  onDetail: (detail: EventDetail) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  return (
    <div className="space-y-4">
      {detail.kind !== "standard" && (
        <p className="text-osrs-parchment-dark/60 text-sm">
          {detail.kind === "bingo"
            ? "Bingo boards are built from tasks: add tasks here (or let the board designer create them), then lay out the grid below."
            : "The dice board draws from a task pool: add tasks here, then lay out the track below."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setAdding((v) => !v);
            setShowLibrary(false);
          }}
          className={primaryBtn}
        >
          {adding ? "Close task form" : "New task"}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowLibrary((v) => !v);
            setAdding(false);
          }}
          className={ghostBtn}
        >
          From library
        </button>
        <HelpTip title="Task library">
          <p>
            Ready-made tasks — curated ones plus anything your clan saved from past events. The
            fastest way to fill an event.
          </p>
        </HelpTip>
      </div>

      {adding && (
        <EventTaskForm
          groupId={groupId}
          eventId={detail.id}
          onSaved={(t) => {
            onTaskSaved(t);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      {showLibrary && (
        <EventTaskLibraryPicker
          groupId={groupId}
          eventId={detail.id}
          onAdded={onTaskSaved}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {tasks.length ? (
        <ul className="divide-osrs-bronze/10 border-osrs-bronze/20 divide-y rounded border">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="text-osrs-parchment/90 truncate font-medium">{t.label}</p>
                <p className="text-osrs-parchment-dark/50 truncate text-xs">
                  {TASK_TYPE_LABELS[t.type]}
                  {taskGoal(t) ? ` · ${taskGoal(t)}` : ""}
                  {t.points ? ` · ${t.points} pts` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemoveTask(t.id)}
                disabled={pending}
                className="text-osrs-red hover:bg-osrs-red/10 shrink-0 rounded px-2 py-1 text-xs disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No tasks yet"
          hint="Add a task above, pull some from the library, or skip — the event manager can do this later too."
        />
      )}

      {detail.kind === "bingo" && (
        <div className="border-osrs-bronze/20 border-t pt-4">
          <h4 className="text-osrs-gold mb-3 text-base font-semibold">Bingo board</h4>
          <EventBingoDesigner groupId={groupId} event={detail} tasks={tasks} onSaved={onDetail} />
        </div>
      )}
      {detail.kind === "board_game" && (
        <div className="border-osrs-bronze/20 border-t pt-4">
          <h4 className="text-osrs-gold mb-3 text-base font-semibold">Game board</h4>
          <EventBoardDesigner groupId={groupId} event={detail} tasks={tasks} />
        </div>
      )}
    </div>
  );
}

/** Teams step: add teams, then fill them — live search or paste a list. */
function WizardTeamsStep({
  groupId,
  detail,
  teams,
  participants,
  participantGroupIds,
  pending,
  formationMode,
  onAddTeam,
  onPickMember,
  onBulkAdd,
  onRemoveMember,
  onDeleteTeam,
}: {
  groupId: number | null;
  detail: EventDetail;
  teams: EventTeam[];
  participants: EventParticipant[];
  participantGroupIds: number[];
  pending: boolean;
  formationMode: EventDetail["formation_mode"];
  onAddTeam: (name: string, clanId: number | null) => Promise<void>;
  onPickMember: (teamId: number, player: { id: number; name: string }) => void;
  onBulkAdd: (teamId: number, names: string[]) => Promise<EventTeamBulkAddResult>;
  onRemoveMember: (teamId: number, playerId: number) => void;
  onDeleteTeam: (teamId: number) => void;
}) {
  const [teamName, setTeamName] = useState("");
  const [teamClanId, setTeamClanId] = useState<number | "">("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addingTeam, setAddingTeam] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const isClanVsClan = detail.mode === "clan_vs_clan";
  const accents = teamColorMap(teams);

  const selfSignup = formationMode !== "admin_assign";

  return (
    <div className="space-y-4">
      {selfSignup && (
        <p className="text-osrs-parchment-dark/60 text-sm">
          Players can also sign themselves up with this event&apos;s joining rules — you don&apos;t
          have to place everyone by hand.
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = teamName.trim();
          if (!trimmed || addingTeam) return;
          if (isClanVsClan && teamClanId === "") {
            setAddError("Pick which clan this team belongs to.");
            return;
          }
          setAddError(null);
          setAddingTeam(true);
          onAddTeam(trimmed, teamClanId === "" ? null : teamClanId)
            .then(() => setTeamName(""))
            .catch((err) =>
              setAddError(getErrorMessage(err, "Couldn't add the team. Please try again.")),
            )
            .finally(() => setAddingTeam(false));
        }}
        className="flex flex-wrap gap-2"
      >
        {isClanVsClan && (
          <select
            value={teamClanId}
            onChange={(e) => setTeamClanId(e.target.value ? Number(e.target.value) : "")}
            className={`${field} min-w-[10rem] flex-none sm:w-52`}
            aria-label="Clan"
          >
            <option value="">Clan…</option>
            {participants.map((p) => (
              <option key={p.group_id} value={p.group_id}>
                {p.group_name ?? `Clan ${p.group_id}`}
              </option>
            ))}
          </select>
        )}
        <input
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="Team name"
          maxLength={80}
          className={`${field} min-w-[10rem] flex-1`}
        />
        <button type="submit" disabled={addingTeam || !teamName.trim()} className={primaryBtn}>
          {addingTeam ? "Adding…" : "Add team"}
        </button>
      </form>
      {addError && <p className="text-osrs-red text-xs">{addError}</p>}

      {teams.length ? (
        <ul className="space-y-4">
          {teams.map((team) => {
            const members = team.members ?? [];
            const clanLabel =
              team.group_id != null
                ? (participants.find((p) => p.group_id === team.group_id)?.group_name ??
                  `Clan ${team.group_id}`)
                : null;
            return (
              <li key={team.id} className="border-osrs-bronze/20 rounded border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      className="inline-block size-3.5 shrink-0 rounded-full"
                      style={{ backgroundColor: accents.get(team.id) }}
                    />
                    {team.name}
                    {clanLabel && (
                      <span className="text-osrs-parchment-dark/50 text-xs">({clanLabel})</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-osrs-parchment-dark/60 mr-1 text-xs">
                      {members.length} player{members.length === 1 ? "" : "s"}
                    </span>
                    {confirmDeleteId === team.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeleteId(null);
                            onDeleteTeam(team.id);
                          }}
                          disabled={pending}
                          className="bg-osrs-red/80 hover:bg-osrs-red text-osrs-parchment rounded px-2 py-1 text-xs font-medium disabled:opacity-50"
                        >
                          Confirm delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-osrs-parchment-dark/70 rounded px-2 py-1 text-xs"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(team.id)}
                        disabled={pending}
                        className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 text-xs disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </span>
                </div>

                {members.length > 0 && (
                  <ul className="divide-osrs-bronze/10 mt-2 divide-y">
                    {members.map((m) => (
                      <li
                        key={m.player_id}
                        className="flex items-center justify-between py-1.5 text-sm"
                      >
                        <span>{m.player_name}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveMember(team.id, m.player_id)}
                          disabled={pending}
                          className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 text-xs disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-2">
                  <PlayerAddInput
                    existingIds={members.map((m) => m.player_id)}
                    disabled={pending}
                    search={(q) =>
                      searchParticipantPlayers(
                        groupId,
                        detail.id,
                        team.group_id != null ? [team.group_id] : participantGroupIds,
                        q,
                      )
                    }
                    onPick={(p) => onPickMember(team.id, p)}
                    onBulkAdd={(names) => onBulkAdd(team.id, names)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="No teams yet"
          hint={
            isClanVsClan
              ? "Optional here — with no teams, it's whole clan vs whole clan."
              : "Add at least one team before launch. One team is fine for a whole-clan event."
          }
        />
      )}
    </div>
  );
}
