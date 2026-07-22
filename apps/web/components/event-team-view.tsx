"use client";

/**
 * Public team page body (participant home base): live score/rank header,
 * per-task progress bars for THIS team, roster with contribution stats, and
 * a recent-activity feed. Subscribes to the event SSE channel while the
 * event is active — progress/completion frames move the bars, bump the
 * score, and prepend feed rows in place.
 */
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { entityPath } from "@/lib/slug";
import type { EventTeamActivity, EventTeamDetail, EventTeamRole } from "@droptracker/api-types";
import {
  assignTeamLeadership,
  removeTeamLeadership,
  voteForTeamLeader,
} from "@/app/(site)/(public)/events/[id]/actions";
import { getErrorMessage } from "@/lib/errors";
import { useEventStream } from "@/lib/use-event-stream";
import { TASK_TYPE_LABELS, taskGoal } from "@/lib/events";
import { formatRelativeTime } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { ItemDbIcon } from "@/components/item-db-icon";
import { EmptyState } from "@/components/ui";
import { EventMemberList } from "@/components/event-member-list";
import { TeamNotificationsButton } from "@/components/event-teams-panel";
import {
  TaskProgressBar,
  formatProgressValue,
  type ProgressCell,
} from "@/components/event-task-progress";

/** Contribution points, 2-dp max with trailing zeros stripped ("2.5", "12"). */
function formatContributionPoints(p: number): string {
  return (Math.round(p * 100) / 100).toString();
}

export function EventTeamView({
  detail,
  live,
  readOnly = false,
  onBack,
  onOpenPlayer,
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
}) {
  const { event, team, members, tasks } = detail;

  const [score, setScore] = useState(team.score);
  const [activity, setActivity] = useState<EventTeamActivity[]>(detail.activity);
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

  useEventStream(live ? [`event:${event.id}`] : [], (frame) => {
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
        // Feed row from the delta (frames carry cumulative progress).
        const delta = Math.max(after.progress - (before?.progress ?? 0), 0);
        if (delta > 0 || completed) {
          setActivity((feed) =>
            [
              {
                id: -Date.now(),
                task_id: taskId,
                task_label: taskById.get(taskId)?.label ?? null,
                player_id: null,
                player_name: data.player_name ?? null,
                quantity: Math.max(delta, 1),
                source_type: completed ? "completion" : null,
                created_at: Math.floor(Date.now() / 1000),
              },
              ...feed,
            ].slice(0, 50),
          );
        }
        const next = new Map(prev);
        next.set(taskId, after);
        return next;
      });
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

  return (
    <div className="space-y-8">
      {/* ── header ──────────────────────────────────────────────────────── */}
      <header>
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
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-osrs-gold flex items-center gap-2.5 text-3xl font-bold">
            {team.color && (
              <span
                className="inline-block size-4 shrink-0 rounded-full"
                style={{ backgroundColor: team.color }}
                aria-hidden
              />
            )}
            {team.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="text-osrs-parchment-dark/70">
              Rank{" "}
              <span className="text-osrs-parchment text-lg font-semibold tabular-nums">
                #{team.rank}
              </span>
              <span className="text-osrs-parchment-dark/50"> / {team.team_count}</span>
            </span>
            <span className="text-osrs-parchment-dark/70">
              Score{" "}
              <span className="text-osrs-gold-bright text-lg font-semibold tabular-nums">
                {score.toLocaleString()}
              </span>
            </span>
            <span className="text-osrs-parchment-dark/70">
              Tasks{" "}
              <span className="text-osrs-parchment text-lg font-semibold tabular-nums">
                {completedCount}
              </span>
              <span className="text-osrs-parchment-dark/50"> / {tasks.length}</span>
            </span>
            <span
              className="text-osrs-parchment-dark/70"
              title="Total tracked loot across the roster during the event — all sources, not just task-credited drops"
            >
              Loot{" "}
              <span className="text-osrs-gold text-lg font-semibold tabular-nums">
                {team.loot_gp?.value_formatted ?? "0"}
              </span>
            </span>
            {event.kind === "board_game" && (
              <span className="text-osrs-parchment-dark/70">
                Coins{" "}
                <span className="text-osrs-parchment text-lg font-semibold tabular-nums">
                  🪙 {team.coins.toLocaleString()}
                </span>
              </span>
            )}
          </div>
        </div>
        {/* Captains (and event admins) tune what this team's auto-provisioned
            Discord channel receives (web53a) — the Web API enforces the
            captain_config / leadership rules on save. */}
        {!readOnly && (isAdmin || viewerRole === "leader" || viewerRole === "co_leader") && (
          <div className="mt-1.5">
            <TeamNotificationsButton eventId={event.id} teamId={team.id} teamName={team.name} />
          </div>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="space-y-8 lg:col-span-2">
          {/* ── per-task progress ─────────────────────────────────────────── */}
          <div>
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
              Task progress
            </h2>
            {tasks.length ? (
              <ul className="divide-osrs-bronze/20 divide-y">
                {tasks.map((t) => {
                  const cell = progress.get(t.id);
                  return (
                    <li key={t.id} className="py-3">
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0">
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
          </div>

          {/* ── items earned (applied ledger, aggregated) ─────────────────── */}
          {detail.items.length > 0 && (
            <div>
              <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
                Items earned
                <span className="text-osrs-parchment-dark/50 ml-2 text-sm font-normal">
                  {detail.items.length}
                </span>
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {detail.items.map((it) => (
                  <span
                    key={it.name}
                    className="bg-osrs-surface-2/40 border-osrs-bronze/15 flex items-center gap-1.5 rounded border px-2 py-1 text-xs"
                    title={`${it.name} — ${it.quantity.toLocaleString()} total across ${it.drops.toLocaleString()} drop${it.drops === 1 ? "" : "s"}`}
                  >
                    {it.item_id != null ? (
                      <ItemDbIcon itemId={it.item_id} size={20} />
                    ) : (
                      <span className="text-osrs-parchment-dark/40">•</span>
                    )}
                    <span className="text-osrs-parchment max-w-[10rem] truncate">{it.name}</span>
                    {it.quantity > 1 && (
                      <span className="text-osrs-parchment-dark/60 tabular-nums">
                        ×{it.quantity.toLocaleString()}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── activity feed ─────────────────────────────────────────────── */}
          <div>
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
              Recent activity
            </h2>
            {activity.length ? (
              <ul className="divide-osrs-bronze/15 divide-y text-sm">
                {activity.map((a) => {
                  const task = a.task_id != null ? taskById.get(a.task_id) : undefined;
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0 truncate">
                        {a.player_id != null && a.player_name ? (
                          onOpenPlayer ? (
                            <button
                              type="button"
                              onClick={() => onOpenPlayer(a.player_id!)}
                              className="text-osrs-parchment hover:text-osrs-gold-bright"
                            >
                              {a.player_name}
                            </button>
                          ) : (
                            <Link
                              href={entityPath("players", a.player_id, a.player_name)}
                              className="text-osrs-parchment hover:text-osrs-gold-bright"
                            >
                              {a.player_name}
                            </Link>
                          )
                        ) : (
                          <span className="text-osrs-parchment">
                            {a.player_name ?? (a.source_type === "manual" ? "Admin award" : "Team")}
                          </span>
                        )}
                        <span className="text-osrs-parchment-dark/60">
                          {" "}
                          {a.source_type === "completion" ? "completed" : "advanced"}{" "}
                        </span>
                        <span className="text-osrs-parchment">{a.task_label ?? `task ${a.task_id}`}</span>
                        {a.matched_target && (
                          <span className="text-osrs-parchment-dark/60"> ({a.matched_target})</span>
                        )}
                        {a.quantity > 1 && task && (
                          <span className="text-osrs-gold/80">
                            {" "}
                            +{formatProgressValue(task, a.quantity)}
                          </span>
                        )}
                      </span>
                      <span className="text-osrs-parchment-dark/40 shrink-0 text-xs">
                        {formatRelativeTime(a.created_at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title="Nothing yet"
                hint="Qualifying drops, kills and records will show up here as the team plays."
              />
            )}
          </div>
        </section>

        {/* ── roster ─────────────────────────────────────────────────────── */}
        <aside>
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
              pageSize={10}
              unit="member"
              listClassName="space-y-2"
              renderRow={(m) => {
                const role = roles.get(m.player_id) ?? null;
                const isSelf = viewer?.player_id === m.player_id;
                // Per-row leadership controls (web48a) — the Web API is the
                // real gatekeeper; these mirror its rules so we only show
                // buttons that can succeed.
                const canMakeLeader =
                  !readOnly && leadership.enabled && isAdmin && role !== "leader";
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
                    className="border-osrs-bronze/20 rounded border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {onOpenPlayer ? (
                          <button
                            type="button"
                            onClick={() => onOpenPlayer(m.player_id)}
                            className="hover:text-osrs-gold-bright truncate text-left font-medium"
                          >
                            {m.player_name}
                          </button>
                        ) : (
                          <Link
                            href={entityPath("players", m.player_id, m.player_name)}
                            className="hover:text-osrs-gold-bright truncate font-medium"
                          >
                            {m.player_name}
                          </Link>
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
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
                        {m.points > 0 && (
                          <span
                            className="text-osrs-gold-bright font-semibold"
                            title="Contribution points — each completed task's points split by this player's share of the work"
                          >
                            {formatContributionPoints(m.points)} pts
                          </span>
                        )}
                        <span
                          className="text-osrs-parchment-dark/60"
                          title="Applied contributions from this player"
                        >
                          {m.completions} contribution{m.completions === 1 ? "" : "s"}
                        </span>
                      </span>
                    </div>
                    <div className="text-osrs-parchment-dark/50 mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                      {m.joined_at && (
                        <span>
                          joined <LocalTime unix={m.joined_at} mode="date" />
                        </span>
                      )}
                      {(m.loot_gp?.value ?? 0) > 0 && (
                        <span
                          className="text-osrs-gold/90 tabular-nums"
                          title="Tracked loot during the event (all sources)"
                        >
                          {m.loot_gp!.value_formatted} loot
                        </span>
                      )}
                    </div>
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
              }}
            />
          ) : (
            <EmptyState title="No members yet" />
          )}
        </aside>
      </div>
    </div>
  );
}
