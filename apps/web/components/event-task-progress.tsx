"use client";

/**
 * Live per-task progress for events — the participant-transparency layer.
 *
 * `EventTaskBoard` renders every task with a per-team progress bar
 * (35/50-style), fed by the `progress[]` rollups on the public event detail
 * and patched live from the event SSE channel (progress / completion /
 * revoke frames), the same way the bingo board consumes cell frames.
 *
 * The progress-state hook and bar primitive are shared with the team page
 * (`event-team-view.tsx`), which shows the same numbers scoped to one team.
 */
import { useMemo, useState } from "react";
import type { EventProgress, EventTask } from "@droptracker/api-types";
import { useEventStream } from "@/lib/use-event-stream";
import { TASK_TYPE_LABELS, taskConfig, taskConfigGroups, taskConfigItems, taskGoal } from "@/lib/events";
import { formatGp } from "@/lib/format";
import { TEAM_COLORS } from "@/components/bingo-board";

type TeamRef = { id: number; name: string };

export type ProgressCell = { progress: number; completed: boolean; completed_at?: number | null };
export type ProgressMap = Map<string, ProgressCell>;

const key = (taskId: number, teamId: number) => `${taskId}:${teamId}`;

/** Completion threshold as the engine computes it (services/event_engine.py):
 * pb/skill tasks complete on the first qualifying entry. */
export function taskThreshold(task: Pick<EventTask, "type" | "target_value">): number {
  if (task.type === "pb_target" || task.type === "skill_target") return 1;
  return Math.max(task.target_value ?? 0, 1);
}

/** Compact progress value per task type (XP / GP read better abbreviated). */
export function formatProgressValue(task: Pick<EventTask, "type">, value: number): string {
  if (task.type === "xp_target" || task.type === "loot_value") return formatGp(value);
  return value.toLocaleString();
}

export function initialProgressMap(progress: EventProgress[] | undefined): ProgressMap {
  const map: ProgressMap = new Map();
  for (const p of progress ?? []) {
    map.set(key(p.task_id, p.team_id), {
      progress: p.progress,
      completed: p.completed,
      completed_at: p.completed_at,
    });
  }
  return map;
}

/** Subscribe to the event channel and fold progress/completion/revoke frames
 * into a (task, team) → progress map. Returns the live map. */
export function useLiveProgress(
  eventId: number | undefined,
  live: boolean,
  initial: EventProgress[] | undefined,
): ProgressMap {
  const [map, setMap] = useState<ProgressMap>(() => initialProgressMap(initial));

  useEventStream(live && eventId ? [`event:${eventId}`] : [], (event) => {
    if (event.type !== "event_update") return;
    const data = event.data as {
      kind?: string;
      task_id?: number | null;
      team_id?: number | null;
      progress?: number;
      completed?: boolean;
      bonus?: string;
    };
    if (typeof data.task_id !== "number" || typeof data.team_id !== "number") return;
    const k = key(data.task_id, data.team_id);
    if (data.kind === "progress" || data.kind === "completion") {
      const completed = data.kind === "completion";
      const progress = typeof data.progress === "number" ? data.progress : null;
      setMap((prev) => {
        const next = new Map(prev);
        const existing = next.get(k);
        next.set(k, {
          progress: progress ?? existing?.progress ?? 0,
          completed: completed || (existing?.completed ?? false),
          completed_at: completed ? Math.floor(Date.now() / 1000) : existing?.completed_at,
        });
        return next;
      });
    } else if (data.kind === "revoke" && !data.bonus) {
      // Non-bonus revoke frames carry the recomputed rollup.
      const progress = typeof data.progress === "number" ? data.progress : 0;
      const completed = data.completed === true;
      setMap((prev) => {
        const next = new Map(prev);
        next.set(k, { progress, completed, completed_at: completed ? next.get(k)?.completed_at : null });
        return next;
      });
    }
  });

  return map;
}

/** One team's bar for one task. */
export function TaskProgressBar({
  task,
  cell,
  color,
  label,
}: {
  task: EventTask;
  cell: ProgressCell | undefined;
  /** Team accent color for the fill; defaults to the gold accent. */
  color?: string;
  /** Optional leading label (team name on the event page). */
  label?: string;
}) {
  const target = taskThreshold(task);
  const done = cell?.completed ?? false;
  const value = Math.min(cell?.progress ?? 0, target);
  const pct = done ? 100 : Math.min(100, Math.floor((value / target) * 100));
  const binary = target === 1; // pb/skill/single-item style: done or not
  return (
    <div className="flex items-center gap-2 text-xs">
      {label && (
        <span className="text-osrs-parchment-dark/70 w-24 shrink-0 truncate" title={label}>
          {label}
        </span>
      )}
      <div className="bg-osrs-brown-dark/70 border-osrs-bronze/20 h-2.5 min-w-0 flex-1 overflow-hidden rounded-full border">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{
            width: `${pct}%`,
            backgroundColor: done ? "#4cb96b" : (color ?? "#e0b34c"),
            opacity: done ? 1 : 0.85,
          }}
        />
      </div>
      <span
        className={`w-24 shrink-0 text-right tabular-nums ${done ? "text-osrs-green" : "text-osrs-parchment-dark/70"}`}
      >
        {done
          ? "✓ complete"
          : binary
            ? "not yet"
            : `${formatProgressValue(task, cell?.progress ?? 0)} / ${formatProgressValue(task, target)}`}
      </span>
    </div>
  );
}

function ItemChip({ name, suffix }: { name: string; suffix?: string }) {
  return (
    <span className="bg-osrs-bronze/15 border-osrs-bronze/25 text-osrs-parchment-dark/80 rounded border px-2 py-0.5 text-xs">
      {name}
      {suffix && <span className="text-osrs-gold/80"> {suffix}</span>}
    </span>
  );
}

/** Expandable "what counts" detail for list-based item tasks. */
function TaskItemList({ task }: { task: EventTask }) {
  const groups = taskConfigGroups(task);
  if (groups.length) {
    // Combined requirements: every group must be satisfied.
    return (
      <div className="mt-2 grid gap-1.5">
        {groups.map((g, gi) => (
          <div key={gi} className="flex flex-wrap items-center gap-1.5">
            <span className="text-osrs-gold-bright/70 text-[10px] font-semibold uppercase">
              {g.mode === "all_of" ? "All of" : g.need > 1 ? `Any ${g.need} of` : "Any of"}
            </span>
            {g.items.map((name) => (
              <ItemChip key={name} name={name} />
            ))}
          </div>
        ))}
      </div>
    );
  }
  const items = taskConfigItems(task);
  if (!items.length) return null;
  const isPoints = taskConfig(task).kind === "point_collection";
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((it) => (
        <ItemChip
          key={it.item_name}
          name={it.item_name}
          suffix={
            isPoints ? `(${it.points ?? 1} pt${(it.points ?? 1) === 1 ? "" : "s"})` : undefined
          }
        />
      ))}
    </div>
  );
}

export function EventTaskBoard({
  tasks,
  teams,
  progress,
  eventId,
  live = false,
  viewerTeamId,
}: {
  tasks: EventTask[];
  teams: TeamRef[];
  progress?: EventProgress[];
  eventId: number;
  live?: boolean;
  /** The signed-in viewer's team — pinned first and highlighted. */
  viewerTeamId?: number | null;
}) {
  const progressMap = useLiveProgress(eventId, live, progress);
  const [expanded, setExpanded] = useState<number | null>(null);

  const teamColor = useMemo(
    () => new Map(teams.map((t, i) => [t.id, TEAM_COLORS[i % TEAM_COLORS.length]!])),
    [teams],
  );
  const orderedTeams = useMemo(() => {
    if (viewerTeamId == null) return teams;
    return [...teams].sort((a, b) => Number(b.id === viewerTeamId) - Number(a.id === viewerTeamId));
  }, [teams, viewerTeamId]);

  if (!tasks.length) return null;

  return (
    <ul className="divide-osrs-bronze/20 divide-y">
      {tasks.map((t) => {
        const doneCount = teams.filter((tm) => progressMap.get(key(t.id, tm.id))?.completed).length;
        const hasItems = taskConfigItems(t).length > 0;
        return (
          <li key={t.id} className="py-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="text-osrs-parchment-dark/50 mr-2 text-xs uppercase">
                  {TASK_TYPE_LABELS[t.type]}
                </span>
                {t.label}
                {taskGoal(t) && <span className="text-osrs-parchment-dark/60"> — {taskGoal(t)}</span>}
                {hasItems && (
                  <button
                    type="button"
                    onClick={() => setExpanded((cur) => (cur === t.id ? null : t.id))}
                    className="text-osrs-gold/70 hover:text-osrs-gold-bright ml-2 text-xs"
                  >
                    {expanded === t.id ? "hide items" : "which items?"}
                  </button>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-3">
                {teams.length > 0 && (
                  <span className="text-osrs-parchment-dark/50 text-xs tabular-nums">
                    {doneCount}/{teams.length} teams
                  </span>
                )}
                {t.points > 0 && (
                  <span className="text-osrs-gold-bright text-sm tabular-nums">{t.points} pts</span>
                )}
              </span>
            </div>
            {expanded === t.id && <TaskItemList task={t} />}
            {teams.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {orderedTeams.map((tm) => (
                  <TaskProgressBar
                    key={tm.id}
                    task={t}
                    cell={progressMap.get(key(t.id, tm.id))}
                    color={teamColor.get(tm.id)}
                    label={tm.name + (tm.id === viewerTeamId ? " ★" : "")}
                  />
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
