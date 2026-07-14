"use client";

/**
 * Public team page body (participant home base): live score/rank header,
 * per-task progress bars for THIS team, roster with contribution stats, and
 * a recent-activity feed. Subscribes to the event SSE channel while the
 * event is active — progress/completion frames move the bars, bump the
 * score, and prepend feed rows in place.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { entityPath } from "@/lib/slug";
import type { EventTeamActivity, EventTeamDetail } from "@droptracker/api-types";
import { useEventStream } from "@/lib/use-event-stream";
import { TASK_TYPE_LABELS, taskGoal } from "@/lib/events";
import { formatRelativeTime } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { EmptyState } from "@/components/ui";
import {
  TaskProgressBar,
  formatProgressValue,
  type ProgressCell,
} from "@/components/event-task-progress";

export function EventTeamView({ detail, live }: { detail: EventTeamDetail; live: boolean }) {
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
        <Link
          href={`/events/${event.id}`}
          className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
        >
          ← {event.name}
        </Link>
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
          <div className="flex items-center gap-6 text-sm">
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
          </div>
        </div>
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
                          <Link
                            href={entityPath("players", a.player_id, a.player_name)}
                            className="text-osrs-parchment hover:text-osrs-gold-bright"
                          >
                            {a.player_name}
                          </Link>
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
          {members.length ? (
            <ul className="space-y-2">
              {members.map((m) => (
                <li
                  key={m.player_id}
                  className="border-osrs-bronze/20 rounded border px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      href={entityPath("players", m.player_id, m.player_name)}
                      className="hover:text-osrs-gold-bright font-medium"
                    >
                      {m.player_name}
                    </Link>
                    <span
                      className="text-osrs-gold-bright text-xs tabular-nums"
                      title="Applied contributions from this player"
                    >
                      {m.completions} contribution{m.completions === 1 ? "" : "s"}
                    </span>
                  </div>
                  {m.joined_at && (
                    <div className="text-osrs-parchment-dark/50 mt-0.5 text-xs">
                      joined <LocalTime unix={m.joined_at} mode="date" />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No members yet" />
          )}
        </aside>
      </div>
    </div>
  );
}
