"use client";

/**
 * Public team page body — a participant's home base for the event, on the
 * website and (read-only) inside the Discord Activity.
 *
 * Order is deliberate: **the roster leads**. Someone opening "My team" wants to
 * see who is on it and what everyone has actually done, so each member card
 * carries their contribution counters, the last thing they credited, and an
 * expandable per-task / per-item breakdown. The team's task progress, item
 * gallery and submission log follow underneath.
 *
 * Every row is built to wrap rather than truncate: the Activity iframe on a
 * phone is ~340px wide, and the old single-line rows pushed the contribution
 * stats off the edge so a member read as nothing but a name and a GP figure.
 *
 * Subscribes to the event SSE channel while the event is active — progress and
 * completion frames move the bars, bump the score, refresh the contributing
 * member's "last contribution" line in place, and (on a completion) reload the
 * submission log so its new line arrives with the real proof URL attached.
 */
import { useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { entityPath } from "@/lib/slug";
import type {
  EventMemberLastContribution,
  EventTeamContributions,
  EventTeamDetail,
  EventTeamMemberStats,
  EventTeamRole,
} from "@droptracker/api-types";
import {
  assignTeamLeadership,
  removeTeamLeadership,
  voteForTeamLeader,
} from "@/app/(site)/(public)/events/[id]/actions";
import { getErrorMessage } from "@/lib/errors";
import { useEventStream } from "@/lib/use-event-stream";
import { LiveStatusBadge } from "@/components/live-status-badge";
import {
  METRIC_TASK_TYPES,
  TASK_TYPE_LABELS,
  contributionSummary,
  effortKillLabel,
  effortPairNote,
  effortSummary,
  formatEheHours,
  isClueEffort,
  taskGoal,
  taskQuantityLabel,
  taskTypeLabel,
} from "@/lib/events";
import { formatRelativeTime } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { ItemDbIcon } from "@/components/item-db-icon";
import { EmptyState } from "@/components/ui";
import { EventMemberList } from "@/components/event-member-list";
import { EheChip, EheValue } from "@/components/event-ehe";
import { TeamNotificationsButton } from "@/components/event-teams-panel";
import { EventTeamContributionLog } from "@/components/event-team-contribution-log";
import { TaskProgressBar, type ProgressCell } from "@/components/event-task-progress";

/** Why the contribution counter reads lower than the submission log suggests. */
const CONTRIBUTIONS_HINT =
  "Times this player moved a task forward. Kill-count, XP and GP tasks count " +
  "once however many updates they took; each item obtained counts separately.";

/** Contribution points, 2-dp max with trailing zeros stripped ("2.5", "12"). */
function formatContributionPoints(p: number): string {
  return (Math.round(p * 100) / 100).toString();
}

/** Compact labelled figure for the team header. Sized to sit four-across on a
 * phone without shrinking its value below legibility. */
function HeaderStat({
  label,
  value,
  sub,
  valueClass = "text-osrs-parchment",
  title,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  valueClass?: string;
  title?: string;
}) {
  return (
    <div
      className="border-osrs-bronze/15 bg-osrs-surface-2/40 min-w-0 rounded-lg border px-2.5 py-1.5"
      title={title}
    >
      <div className="text-osrs-parchment-dark/55 text-[10px] tracking-wide uppercase">{label}</div>
      <div className={`mt-0.5 truncate text-base font-semibold tabular-nums ${valueClass}`}>
        {value}
        {sub && <span className="text-osrs-parchment-dark/45 text-xs font-normal"> {sub}</span>}
      </div>
    </div>
  );
}

/** Item chips shared by the team gallery and a member's breakdown. */
function ItemChips({
  items,
  size = 20,
}: {
  items: EventTeamDetail["items"];
  size?: number;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span
          key={it.name}
          className="bg-osrs-surface-2/40 border-osrs-bronze/15 flex min-w-0 items-center gap-1.5 rounded border px-2 py-1 text-xs"
          title={`${it.name} — ${it.quantity.toLocaleString()} total across ${it.drops.toLocaleString()} drop${it.drops === 1 ? "" : "s"}`}
        >
          {it.item_id != null ? (
            <ItemDbIcon itemId={it.item_id} size={size} />
          ) : (
            <span className="text-osrs-parchment-dark/40">•</span>
          )}
          <span className="text-osrs-parchment max-w-[9rem] truncate">{it.name}</span>
          {it.quantity > 1 && (
            <span className="text-osrs-parchment-dark/60 tabular-nums">
              ×{it.quantity.toLocaleString()}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

export function EventTeamView({
  detail,
  live,
  readOnly = false,
  onBack,
  onOpenPlayer,
  loadContributions,
}: {
  detail: EventTeamDetail;
  live: boolean;
  /** Discord Activity: hide notification/leadership controls (their server
   * actions can't run from the iframe) and render a read-only roster. */
  readOnly?: boolean;
  /** Discord Activity: replaces the ← event back-link (site route) with an
   * in-app stack pop. */
  onBack?: () => void;
  /** Discord Activity: swaps player links for in-app view pushes. */
  onOpenPlayer?: (playerId: number) => void;
  /** Discord Activity: bearer-authed loader for the submission log, which is
   * fetched separately from `detail` (cookies don't reach the iframe). */
  loadContributions?: (page: number) => Promise<EventTeamContributions>;
}) {
  const { event, team, members, tasks } = detail;

  const [score, setScore] = useState(team.score);
  // Bumped on every completion frame so the submission log below refetches —
  // it owns its own (paginated, proof-carrying) rows rather than being fed
  // synthesized ones, so a reload is how a new line arrives.
  const [logVersion, setLogVersion] = useState(0);
  const [progress, setProgress] = useState<Map<number, ProgressCell>>(
    () =>
      new Map(
        tasks.map((t) => [
          t.id,
          { progress: t.progress, completed: t.completed, completed_at: t.completed_at },
        ]),
      ),
  );

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  // Live "last contribution" overlay, keyed by player id. SSE frames name the
  // contributor rather than identifying them, so they're matched back to the
  // roster by name (see the stream handler below).
  const [liveLast, setLiveLast] = useState<Map<number, EventMemberLastContribution>>(new Map());

  // Which roster rows have their contribution breakdown open.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpanded = (playerId: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(playerId)) next.add(playerId);
      return next;
    });

  // ── team leadership (web48a) ──────────────────────────────────────────
  // Roles live in local state so appoint/remove/vote update the roster
  // in place — the server actions revalidate, but the client shouldn't
  // need a reload to see the crown move.
  const leadership = event.leadership;
  const viewer = detail.viewer ?? null;
  const [roles, setRoles] = useState<Map<number, EventTeamRole | null>>(
    () => new Map(members.map((m) => [m.player_id, m.role ?? null])),
  );
  const [myVote, setMyVote] = useState<number | null>(viewer?.vote ?? null);
  const [leadershipError, setLeadershipError] = useState<string | null>(null);
  const [leadershipBusy, startLeadership] = useTransition();

  // Derived from local roles so a self-demotion immediately drops the
  // viewer's leader-only controls.
  const viewerRole = viewer?.player_id != null ? (roles.get(viewer.player_id) ?? null) : null;
  const isAdmin = viewer?.is_admin === true;
  const canVote =
    leadership.enabled &&
    leadership.selection === "election" &&
    viewer?.player_id != null &&
    event.status !== "past";

  /** Assign leader/co-leader; on success the same role is cleared off any
   * previous holder locally (one crown per team). */
  const assignRole = (playerId: number, role: EventTeamRole) => {
    setLeadershipError(null);
    startLeadership(async () => {
      try {
        await assignTeamLeadership(event.id, team.id, playerId, role);
        setRoles((prev) => {
          const next = new Map(prev);
          for (const [pid, r] of next) if (r === role) next.set(pid, null);
          next.set(playerId, role);
          return next;
        });
      } catch (err) {
        setLeadershipError(getErrorMessage(err, "Couldn't update leadership."));
      }
    });
  };

  const removeRole = (playerId: number) => {
    setLeadershipError(null);
    startLeadership(async () => {
      try {
        await removeTeamLeadership(event.id, team.id, playerId);
        setRoles((prev) => {
          const next = new Map(prev);
          next.set(playerId, null);
          return next;
        });
      } catch (err) {
        setLeadershipError(getErrorMessage(err, "Couldn't remove that role."));
      }
    });
  };

  const castVote = (candidateId: number) => {
    setLeadershipError(null);
    startLeadership(async () => {
      try {
        const res = await voteForTeamLeader(event.id, team.id, candidateId);
        setMyVote(candidateId);
        // The election may have flipped the leader — sync local roles.
        setRoles((prev) => {
          const next = new Map(prev);
          for (const [pid, r] of next) {
            if (r === "leader" && pid !== res.leader_player_id) next.set(pid, null);
          }
          if (res.leader_player_id != null) next.set(res.leader_player_id, "leader");
          return next;
        });
      } catch (err) {
        setLeadershipError(getErrorMessage(err, "Couldn't cast your vote."));
      }
    });
  };

  // Roster doubles as a contribution leaderboard: most points first, then
  // most applied contributions, then name for a stable tail.
  const rosterMembers = useMemo(
    () =>
      [...members].sort(
        (a, b) =>
          b.points - a.points ||
          b.completions - a.completions ||
          a.player_name.localeCompare(b.player_name),
      ),
    [members],
  );

  // Name → player id, for attributing SSE frames (which carry only a name).
  const idByName = useMemo(
    () => new Map(members.map((m) => [m.player_name.toLowerCase(), m.player_id])),
    [members],
  );

  const { state: streamState } = useEventStream(live ? [`event:${event.id}`] : [], (frame) => {
    if (frame.type !== "event_update") return;
    const data = frame.data as {
      kind?: string;
      task_id?: number | null;
      team_id?: number | null;
      progress?: number;
      completed?: boolean;
      team_score?: number;
      player_name?: string;
      bonus?: string;
    };
    if (data.team_id !== team.id) return;
    if (typeof data.team_score === "number") setScore(data.team_score);
    if (typeof data.task_id !== "number") return;
    const taskId = data.task_id;

    if (data.kind === "progress" || data.kind === "completion") {
      const completed = data.kind === "completion";
      setProgress((prev) => {
        const before = prev.get(taskId);
        const after: ProgressCell = {
          progress: typeof data.progress === "number" ? data.progress : (before?.progress ?? 0),
          completed: completed || (before?.completed ?? false),
          completed_at: completed
            ? Math.floor(Date.now() / 1000)
            : (before?.completed_at ?? null),
        };
        // Frames carry cumulative progress; the delta is what just happened.
        const delta = Math.max(after.progress - (before?.progress ?? 0), 0);
        if (delta > 0 || completed) {
          const at = Math.floor(Date.now() / 1000);
          const quantity = Math.max(delta, 1);
          // Freshen the contributor's roster line so "last contribution"
          // doesn't go stale while someone watches the page.
          const pid = data.player_name
            ? idByName.get(data.player_name.toLowerCase())
            : undefined;
          if (pid != null) {
            const task = taskById.get(taskId);
            setLiveLast((prev) =>
              new Map(prev).set(pid, {
                task_id: taskId,
                task_label: task?.label ?? null,
                task_type: task?.type ?? null,
                quantity,
                source_type: completed ? "completion" : null,
                matched_target: null,
                created_at: at,
              }),
            );
          }
        }
        const next = new Map(prev);
        next.set(taskId, after);
        return next;
      });
      // A completion mints a real ledger row — pull the submission log again
      // so the new line (and its screenshot) lands without a page reload.
      if (completed) setLogVersion((v) => v + 1);
    } else if (data.kind === "revoke" && !data.bonus) {
      setProgress((prev) => {
        const next = new Map(prev);
        next.set(taskId, {
          progress: typeof data.progress === "number" ? data.progress : 0,
          completed: data.completed === true,
          completed_at: data.completed === true ? prev.get(taskId)?.completed_at : null,
        });
        return next;
      });
    }
  });

  const completedCount = tasks.filter((t) => progress.get(t.id)?.completed).length;
  const contributors = members.filter((m) => m.completions > 0 || m.points > 0).length;
  // The team total carries no rates flag of its own — it is a sum of the same
  // rows the members are priced from, so if any member's pricing is
  // unavailable the total is an undercount too.
  const teamRatesKnown = !members.some((m) => m.effort?.rates_known === false);

  /** One roster card: identity, counters, what they did last, and (on demand)
   * the full per-task / per-item breakdown. */
  const renderMember = (m: EventTeamMemberStats) => {
    const role = roles.get(m.player_id) ?? null;
    const isSelf = viewer?.player_id === m.player_id;
    const last = liveLast.get(m.player_id) ?? m.last_contribution ?? null;
    const isOpen = expanded.has(m.player_id);
    // Effort counts as a breakdown of its own: a member who ground a boss all
    // week with nothing to show has no tasks and no items, and they are
    // precisely the person this expander needs to open for.
    const hasBreakdown =
      (m.tasks?.length ?? 0) > 0 ||
      (m.items?.length ?? 0) > 0 ||
      (m.effort?.bosses?.length ?? 0) > 0;
    // Per-row leadership controls (web48a) — the Web API is the real
    // gatekeeper; these mirror its rules so we only show buttons that
    // can succeed.
    const canMakeLeader = !readOnly && leadership.enabled && isAdmin && role !== "leader";
    const canMakeCoLeader =
      !readOnly &&
      leadership.enabled &&
      leadership.co_leaders &&
      (isAdmin || viewerRole === "leader") &&
      role !== "co_leader";
    const canRemoveRole =
      !readOnly &&
      leadership.enabled &&
      role != null &&
      (isAdmin || (viewerRole === "leader" && role === "co_leader") || isSelf);
    const showVote = !readOnly && canVote;
    const hasControls = canMakeLeader || canMakeCoLeader || canRemoveRole || showVote;

    return (
      <li
        key={m.player_id}
        className={`min-w-0 rounded-lg border px-3 py-2.5 text-sm ${
          isSelf
            ? "border-osrs-gold/45 bg-osrs-gold/[0.06]"
            : "border-osrs-bronze/20 bg-osrs-surface-1/25"
        }`}
      >
        {/* Identity — wraps onto a second line rather than truncating away
            the badges on a narrow viewport. */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          {onOpenPlayer ? (
            <button
              type="button"
              onClick={() => onOpenPlayer(m.player_id)}
              className="hover:text-osrs-gold-bright min-w-0 text-left font-medium break-words"
            >
              {m.player_name}
            </button>
          ) : (
            <Link
              href={entityPath("players", m.player_id, m.player_name)}
              className="hover:text-osrs-gold-bright min-w-0 font-medium break-words"
            >
              {m.player_name}
            </Link>
          )}
          {isSelf && (
            <span className="border-osrs-gold/40 text-osrs-gold/90 shrink-0 rounded border px-1.5 py-px text-[10px] font-semibold">
              You
            </span>
          )}
          {leadership.enabled && role === "leader" && (
            <span className="border-osrs-gold/40 bg-osrs-gold/15 text-osrs-gold shrink-0 rounded border px-1.5 py-px text-[10px] font-semibold">
              👑 Leader
            </span>
          )}
          {leadership.enabled && role === "co_leader" && (
            <span className="border-osrs-bronze/40 bg-osrs-bronze/15 text-osrs-parchment-dark/80 shrink-0 rounded border px-1.5 py-px text-[10px] font-semibold">
              ⭐ Co-leader
            </span>
          )}
        </div>

        {/* Counters — a wrapping row, so nothing gets pushed off-screen. */}
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs tabular-nums">
          <span
            className="text-osrs-gold-bright font-semibold"
            title="Contribution points — each completed task's points split by this player's share of the work"
          >
            {formatContributionPoints(m.points)} pts
          </span>
          <span className="text-osrs-parchment-dark/60" title={CONTRIBUTIONS_HINT}>
            {m.completions.toLocaleString()} contribution{m.completions === 1 ? "" : "s"}
          </span>
          {m.tasks_contributed > 0 && (
            <span
              className="text-osrs-parchment-dark/60"
              title="Distinct tasks this player has moved forward"
            >
              {m.tasks_contributed} task{m.tasks_contributed === 1 ? "" : "s"}
            </span>
          )}
          {(m.loot_gp?.value ?? 0) > 0 && (
            <span
              className="text-osrs-gold/90"
              title="Tracked loot during the event (all sources, not just task-credited drops)"
            >
              {m.loot_gp!.value_formatted} loot
            </span>
          )}
          <EheChip effort={m.effort} className="text-osrs-parchment-dark/70" />
        </div>

        {/* Most recent contribution — the "what have they been up to" line. */}
        <div className="text-osrs-parchment-dark/60 mt-1.5 text-xs break-words">
          {last ? (
            <>
              <span className="text-osrs-parchment-dark/40">Last </span>
              <span className="text-osrs-parchment/90">{contributionSummary(last)}</span>
              <span className="text-osrs-parchment-dark/40"> on </span>
              <span className="text-osrs-parchment-dark/80">
                {last.task_label ?? `task ${last.task_id}`}
              </span>
              <span className="text-osrs-parchment-dark/40">
                {" · "}
                {formatRelativeTime(last.created_at)}
              </span>
            </>
          ) : (
            <span className="text-osrs-parchment-dark/40">
              No contributions yet
              {m.joined_at ? (
                <>
                  {" · joined "}
                  <LocalTime unix={m.joined_at} mode="date" />
                </>
              ) : null}
            </span>
          )}
        </div>

        {hasBreakdown && (
          <button
            type="button"
            onClick={() => toggleExpanded(m.player_id)}
            aria-expanded={isOpen}
            className="text-osrs-gold-bright/80 hover:text-osrs-gold-bright mt-1.5 text-xs"
          >
            {isOpen ? "Hide contributions ▴" : "Show contributions ▾"}
          </button>
        )}

        {isOpen && hasBreakdown && (
          <div className="border-osrs-bronze/15 mt-2 space-y-2 border-t pt-2">
            {(m.tasks?.length ?? 0) > 0 && (
              <ul className="space-y-1">
                {m.tasks.map((t) => (
                  <li key={t.task_id} className="min-w-0 text-xs">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                      <span className="min-w-0 break-words">
                        <span className="text-osrs-parchment-dark/40 mr-1.5 text-[10px] uppercase">
                          {taskTypeLabel(t.task_type)}
                        </span>
                        <span className="text-osrs-parchment/90">
                          {t.task_label ?? `Task ${t.task_id}`}
                        </span>
                      </span>
                      <span className="text-osrs-parchment-dark/60 shrink-0 tabular-nums">
                        {taskQuantityLabel(t.task_type, t.quantity)}
                        {/* Metric tasks fold to one contribution, so printing
                            "1 contribution" beside "50 kills" would just read
                            like a bug — the quantity already tells that story.
                            Separate acquisitions are worth spelling out. */}
                        {!METRIC_TASK_TYPES.has(t.task_type ?? "") && t.contributions > 1 && (
                          <span className="text-osrs-parchment-dark/40">
                            {" over "}
                            {t.contributions} contributions
                          </span>
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {(m.items?.length ?? 0) > 0 && <ItemChips items={m.items} size={18} />}
            {(m.effort?.bosses?.length ?? 0) > 0 && (
              <div className="border-osrs-bronze/15 space-y-1 border-t pt-2">
                <div className="text-osrs-parchment-dark/40 text-[10px] uppercase">
                  EHE · {effortSummary(m.effort)}
                </div>
                <ul className="space-y-1">
                  {m.effort!.bosses.map((b) => (
                    <li
                      key={`${b.npc_id ?? b.name}`}
                      className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs"
                    >
                      <span className="min-w-0 break-words">
                        <span className="text-osrs-parchment/90">{b.name ?? "Unknown"}</span>
                        {b.frozen && (
                          <span
                            className="text-osrs-parchment-dark/40 ml-1.5 text-[10px]"
                            title="Every task this boss counted toward is done, so it stopped accruing"
                          >
                            (done)
                          </span>
                        )}
                      </span>
                      <span
                        className="text-osrs-parchment-dark/60 shrink-0 tabular-nums"
                        title={effortPairNote(b)}
                      >
                        {effortKillLabel(b)}
                        {isClueEffort(b) && (
                          <span className="text-osrs-parchment-dark/40">
                            {" · "}
                            {(b.paired ?? 0).toLocaleString()} paired
                          </span>
                        )}
                        {b.ehb_hours > 0 && (
                          <span className="text-osrs-parchment-dark/40">
                            {" · "}
                            {formatEheHours(b.ehb_hours, b.estimated)}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {hasControls && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {showVote &&
              (myVote === m.player_id ? (
                <span className="text-osrs-gold font-medium">Voted ✓</span>
              ) : (
                <button
                  type="button"
                  disabled={leadershipBusy}
                  onClick={() => castVote(m.player_id)}
                  className="text-osrs-gold-bright hover:underline disabled:opacity-50"
                  title="Vote for this player as team leader"
                >
                  Vote
                </button>
              ))}
            {canMakeLeader && (
              <button
                type="button"
                disabled={leadershipBusy}
                onClick={() => assignRole(m.player_id, "leader")}
                className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright hover:underline disabled:opacity-50"
              >
                Make leader
              </button>
            )}
            {canMakeCoLeader && (
              <button
                type="button"
                disabled={leadershipBusy}
                onClick={() => assignRole(m.player_id, "co_leader")}
                className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright hover:underline disabled:opacity-50"
              >
                Make co-leader
              </button>
            )}
            {canRemoveRole && (
              <button
                type="button"
                disabled={leadershipBusy}
                onClick={() => removeRole(m.player_id)}
                className="text-osrs-parchment-dark/50 hover:text-osrs-red hover:underline disabled:opacity-50"
              >
                {isSelf && !isAdmin ? "Step down" : "Remove role"}
              </button>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="min-w-0 space-y-8">
      {/* ── header ──────────────────────────────────────────────────────── */}
      <header className="min-w-0">
        {live ? (
          <div className="float-right">
            <LiveStatusBadge state={streamState} />
          </div>
        ) : null}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
          >
            ← {event.name}
          </button>
        ) : (
          <Link
            href={`/events/${event.id}`}
            className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
          >
            ← {event.name}
          </Link>
        )}
        <h1 className="text-osrs-gold mt-1 flex min-w-0 items-center gap-2.5 text-2xl font-bold break-words sm:text-3xl">
          {team.color && (
            <span
              className="inline-block size-4 shrink-0 rounded-full"
              style={{ backgroundColor: team.color }}
              aria-hidden
            />
          )}
          {team.name}
        </h1>
        {/* A grid, not a wrapping inline row: on a phone these used to collide
            and clip. Two across at the narrowest, five on a wide screen. */}
        <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
          <HeaderStat label="Rank" value={`#${team.rank}`} sub={`/ ${team.team_count}`} />
          <HeaderStat
            label="Score"
            value={score.toLocaleString()}
            valueClass="text-osrs-gold-bright"
          />
          <HeaderStat label="Tasks" value={`${completedCount}`} sub={`/ ${tasks.length}`} />
          <HeaderStat
            label="Loot"
            value={team.loot_gp?.value_formatted ?? "0"}
            valueClass="text-osrs-gold"
            title="Total tracked loot across the roster during the event — all sources, not just task-credited drops"
          />
          <HeaderStat
            label="EHE"
            value={
              <EheValue
                hours={team.ehb_hours}
                estimatedHours={team.ehb_estimated_hours}
                ratesKnown={teamRatesKnown}
              />
            }
          />
          {event.kind === "board_game" ? (
            <HeaderStat label="Coins" value={`🪙 ${team.coins.toLocaleString()}`} />
          ) : (
            <HeaderStat
              label="Contributors"
              value={`${contributors}`}
              sub={`/ ${members.length}`}
              title="Members who have scored at least once"
            />
          )}
        </div>
        {/* Captains (and event admins) tune what this team's auto-provisioned
            Discord channel receives (web53a) — the Web API enforces the
            captain_config / leadership rules on save. */}
        {!readOnly && (isAdmin || viewerRole === "leader" || viewerRole === "co_leader") && (
          <div className="mt-2">
            <TeamNotificationsButton eventId={event.id} teamId={team.id} teamName={team.name} />
          </div>
        )}
      </header>

      {/* ── roster (leads the page) ───────────────────────────────────────── */}
      <section className="min-w-0">
        <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
          Members
          <span className="text-osrs-parchment-dark/50 ml-2 text-sm font-normal">
            {members.length}
          </span>
        </h2>
        {leadershipError && (
          <p className="text-osrs-red mb-2 text-xs" role="alert">
            {leadershipError}
          </p>
        )}
        {members.length ? (
          <EventMemberList
            members={rosterMembers}
            pageSize={12}
            unit="member"
            listClassName="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
            renderRow={renderMember}
          />
        ) : (
          <EmptyState title="No members yet" />
        )}
      </section>

      {/* ── per-task progress ─────────────────────────────────────────────── */}
      <section className="min-w-0">
        <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
          Task progress
        </h2>
        {tasks.length ? (
          <ul className="divide-osrs-bronze/20 divide-y">
            {tasks.map((t) => {
              const cell = progress.get(t.id);
              return (
                <li key={t.id} className="py-3">
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="min-w-0 break-words">
                      <span className="text-osrs-parchment-dark/50 mr-2 text-xs uppercase">
                        {TASK_TYPE_LABELS[t.type]}
                      </span>
                      {t.label}
                      {taskGoal(t) && (
                        <span className="text-osrs-parchment-dark/60"> — {taskGoal(t)}</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-xs">
                      {cell?.completed && cell.completed_at ? (
                        <span className="text-osrs-parchment-dark/50">
                          completed <LocalTime unix={cell.completed_at} mode="date" />
                        </span>
                      ) : null}
                      {t.points > 0 && (
                        <span className="text-osrs-gold-bright text-sm tabular-nums">
                          {t.points} pts
                        </span>
                      )}
                    </span>
                  </div>
                  <TaskProgressBar task={t} cell={cell} color={team.color ?? undefined} />
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="No tasks yet" />
        )}
      </section>

      <div className="grid min-w-0 gap-8">
        {/* ── items earned (applied ledger, aggregated) ─────────────────── */}
        {detail.items.length > 0 && (
          <section className="min-w-0">
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
              Items earned
              <span className="text-osrs-parchment-dark/50 ml-2 text-sm font-normal">
                {detail.items.length}
              </span>
            </h2>
            <ItemChips items={detail.items} />
          </section>
        )}

        {/* ── submission log (t62) ──────────────────────────────────────────
            Replaces the old "Recent activity" feed, which rendered one line per
            applied ledger row: on a GP or kill-count task that is a line per
            drop, so the drops people actually want to see were buried. The log
            keeps acquisitions (with proof) and rolls the ticks up. */}
        <section id="submission-log" className="min-w-0 scroll-mt-24">
          <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
            Submission log
          </h2>
          <p className="text-osrs-parchment-dark/60 mb-3 text-sm">
            Everything this team has banked — who got it, when, and the screenshot.
          </p>
          <EventTeamContributionLog
            eventId={event.id}
            teamId={team.id}
            refreshKey={logVersion}
            loadPage={loadContributions}
            onOpenPlayer={onOpenPlayer}
          />
        </section>
      </div>
    </div>
  );
}
