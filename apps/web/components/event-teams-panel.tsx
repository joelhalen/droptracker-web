"use client";

/**
 * Event-page "Teams" standings aside. Each team shows its rank, color, name,
 * player count, tasks done, and score. Rosters stay compact: small teams list
 * inline, but large teams (the clan-vs-clan case, 400+ members) collapse behind
 * a disclosure that reveals a searchable, paginated `EventMemberList` — so a
 * massive event no longer turns the page into an endless scroll.
 */
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  TEAM_MESSAGE_TOGGLE_KEYS,
  type EventMember,
  type EventPrizePotSummary,
  type EventProgress,
  type EventTaskProgressMode,
  type EventTeam,
  type EventTeamRole,
  type TeamMessageToggleKey,
} from "@droptracker/api-types";
import { saveMyTeamNotifications } from "@/app/(site)/(public)/events/[id]/actions";
import { getErrorMessage } from "@/lib/errors";
import { entityPath } from "@/lib/slug";
import { teamColorMap } from "@/lib/events";
import { StatTile } from "@/components/ui";
import { LocalTime } from "@/components/local-time";
import { EventMemberList } from "@/components/event-member-list";

/** Rosters up to this size render inline; larger ones collapse. */
const INLINE_MAX = 6;

/** One-line description of who's advertised to take the pot. */
function distributionHint(pot: EventPrizePotSummary): string {
  if (pot.distribution === "top_n" && pot.top_n > 1) return `Top ${pot.top_n} teams split it`;
  if (pot.distribution === "custom_split") return "Split among the top teams";
  return "Winner takes all";
}

function MemberRow({ m }: { m: EventMember }) {
  return (
    <li key={m.player_id} className="flex items-center justify-between">
      <Link
        href={entityPath("players", m.player_id, m.player_name)}
        className="hover:text-osrs-gold-bright"
      >
        {m.player_name}
      </Link>
      {m.joined_at != null && (
        <span className="text-osrs-parchment-dark/40">
          joined <LocalTime unix={m.joined_at} mode="date" />
        </span>
      )}
    </li>
  );
}

// ── Team channel notifications (web53a) ─────────────────────────────────────

/** Friendly labels for each notification a team's Discord channel can carry. */
const TEAM_TOGGLE_LABELS: Record<TeamMessageToggleKey, string> = {
  event_completion: "Task completions",
  event_task_progress: "Task progress",
  event_line: "Bingo lines",
  event_blackout: "Blackouts",
  event_lead_change: "Lead changes",
  event_board_turn: "Board: dice rolls",
  event_board_roll_prompt: "Board: roll prompts",
};

/** Team-channel defaults: everything on (roll prompts included — unlike the
 * event's main channels, team channels carry them by default). */
function defaultTeamToggles(): Record<TeamMessageToggleKey, boolean> {
  return Object.fromEntries(TEAM_MESSAGE_TOGGLE_KEYS.map((k) => [k, true])) as Record<
    TeamMessageToggleKey,
    boolean
  >;
}

/** Small modal where a captain (or event admin) tunes which notifications
 * their team's auto-provisioned Discord channel receives. There's no captain
 * read endpoint, so it seeds from the defaults and reflects the server's
 * returned state after the first save. */
function TeamNotificationsDialog({
  eventId,
  teamId,
  teamName,
  onClose,
}: {
  eventId: number;
  teamId: number;
  teamName: string;
  onClose: () => void;
}) {
  const [toggles, setToggles] = useState<Record<TeamMessageToggleKey, boolean>>(defaultTeamToggles);
  const [taskProgress, setTaskProgress] = useState<EventTaskProgressMode>("all");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const res = await saveMyTeamNotifications(eventId, teamId, {
          toggles,
          task_progress: taskProgress,
        });
        // Reflect what the server actually stored (it may clamp/merge).
        setToggles((prev) => ({
          ...prev,
          ...(res.notifications.toggles as Partial<Record<TeamMessageToggleKey, boolean>>),
        }));
        setTaskProgress(res.notifications.task_progress);
        setSaved(true);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save the team notification settings."));
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Team notifications — ${teamName}`}
        className="border-osrs-bronze/30 bg-osrs-surface-1 relative w-full max-w-sm rounded-xl border shadow-2xl"
      >
        <div className="border-osrs-bronze/20 flex items-center justify-between gap-3 border-b px-4 py-3">
          <h3 className="text-osrs-gold text-base font-semibold">Team notifications</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-lg leading-none"
          >
            ×
          </button>
        </div>
        <div className="space-y-3 px-4 py-3">
          <p className="text-osrs-parchment-dark/60 text-xs">
            Settings apply to {teamName}&apos;s Discord channel. Values shown are the defaults
            until you save.
          </p>
          <ul className="space-y-1.5">
            {TEAM_MESSAGE_TOGGLE_KEYS.map((key) => (
              <li key={key}>
                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                  <span>{TEAM_TOGGLE_LABELS[key]}</span>
                  <input
                    type="checkbox"
                    checked={toggles[key]}
                    onChange={(e) =>
                      setToggles((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="size-4"
                  />
                </label>
              </li>
            ))}
          </ul>
          <label className="block text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
              Task progress detail
            </span>
            <select
              value={taskProgress}
              onChange={(e) => setTaskProgress(e.target.value as EventTaskProgressMode)}
              className="border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none"
            >
              <option value="off">Off</option>
              <option value="milestones">Milestones (25/50/75%)</option>
              <option value="all">Every update</option>
            </select>
          </label>
          {error && (
            <p className="text-osrs-red text-xs" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="border-osrs-bronze/20 flex items-center gap-3 border-t px-4 py-3">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {saved && <span className="text-osrs-gold-bright text-xs">Saved.</span>}
        </div>
      </div>
    </div>
  );
}

/** Gear entry point for the dialog — shown to a team's leader/co-leader (and
 * event admins). Rendered on the public team page (event-team-view.tsx) and,
 * when the parent passes viewer context, in the standings panel below. */
export function TeamNotificationsButton({
  eventId,
  teamId,
  teamName,
  className = "",
}: {
  eventId: number;
  teamId: number;
  teamName: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Team notifications — choose what your team's Discord channel receives"
        className={`text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs ${className}`}
      >
        ⚙ Team notifications
      </button>
      {open && (
        <TeamNotificationsDialog
          eventId={eventId}
          teamId={teamId}
          teamName={teamName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function EventTeamsPanel({
  eventId,
  teams,
  progress,
  taskCount,
  viewerTeamId,
  prizePot,
  viewerTeamRole,
  canManage = false,
}: {
  eventId: number;
  teams: EventTeam[];
  progress?: EventProgress[];
  taskCount: number;
  viewerTeamId?: number | null;
  /** Prize-pot headline (web52a); shown only when the pot is enabled. Updates
   * live via the event-detail SSE refresh that feeds this component. */
  prizePot?: EventPrizePotSummary | null;
  /** Leadership role the viewer holds on their team (web53a) — with
   * viewerTeamId it surfaces the "Team notifications" gear on their row.
   * Optional so existing callers are unaffected. */
  viewerTeamRole?: EventTeamRole | null;
  /** Event admins get the gear on every team. */
  canManage?: boolean;
}) {
  // Colors resolve against the unsorted roster so palette fallbacks stay stable
  // as standings change.
  const teamColor = teamColorMap(teams);
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const showPot = Boolean(prizePot?.enabled);

  return (
    <>
      {showPot && prizePot && (
        <StatTile
          label="Prize Pot"
          value={`${prizePot.total.value_formatted} GP`}
          hint={distributionHint(prizePot)}
          className="mb-3"
        />
      )}
      <ol className="space-y-2">
      {sorted.map((team, i) => {
        const done = (progress ?? []).filter((p) => p.team_id === team.id && p.completed).length;
        const members = team.members ?? [];
        const isViewer = viewerTeamId != null && team.id === viewerTeamId;
        // Captains see the notifications gear on THEIR team; admins on all.
        const showNotifGear =
          canManage ||
          (isViewer && (viewerTeamRole === "leader" || viewerTeamRole === "co_leader"));
        return (
          <li
            key={team.id}
            className={`rounded border px-3 py-2 text-sm transition-colors ${
              isViewer
                ? "border-osrs-gold/40"
                : "border-osrs-bronze/20 hover:border-osrs-bronze/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span>
                <span className="text-osrs-parchment-dark/50 mr-2 tabular-nums">{i + 1}</span>
                <span
                  className="mr-1.5 inline-block size-2 rounded-full align-baseline"
                  style={{ backgroundColor: teamColor.get(team.id) }}
                  aria-hidden
                />
                <Link
                  href={`/events/${eventId}/teams/${team.id}`}
                  className="hover:text-osrs-gold-bright font-medium"
                >
                  {team.name}
                </Link>
                <span className="text-osrs-parchment-dark/50 ml-2 text-xs">
                  {team.member_count} players
                  {done > 0 ? ` · ${done}/${taskCount} tasks` : ""}
                  {showPot && team.pot_total && team.pot_total.value > 0
                    ? ` · 💰 ${team.pot_total.value_formatted}`
                    : ""}
                </span>
              </span>
              <span className="text-osrs-gold-bright tabular-nums">{team.score}</span>
            </div>

            {showNotifGear && (
              <div className="mt-1">
                <TeamNotificationsButton
                  eventId={eventId}
                  teamId={team.id}
                  teamName={team.name}
                />
              </div>
            )}

            {members.length > 0 && members.length <= INLINE_MAX && (
              <ul className="text-osrs-parchment-dark/70 mt-2 space-y-0.5 text-xs">
                {members.map((m) => (
                  <MemberRow key={m.player_id} m={m} />
                ))}
              </ul>
            )}

            {members.length > INLINE_MAX && (
              <details className="group mt-2">
                <summary className="text-osrs-gold/70 hover:text-osrs-gold-bright cursor-pointer list-none text-xs select-none [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Show roster ({members.length})</span>
                  <span className="hidden group-open:inline">Hide roster</span>
                </summary>
                <div className="mt-2">
                  <EventMemberList
                    members={members}
                    pageSize={8}
                    listClassName="text-osrs-parchment-dark/70 space-y-0.5 text-xs"
                    renderRow={(m) => <MemberRow key={m.player_id} m={m} />}
                  />
                </div>
              </details>
            )}
          </li>
        );
      })}
      </ol>
    </>
  );
}
