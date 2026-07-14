"use client";

/**
 * Public bingo board (FRONTEND_PLAN.md §14.1, upgraded by Task 20 B3, tile
 * art + hover cards by the tile-resurrection pass).
 *
 * Cells render rich tile art (`BingoTile` — item/npc/skill icon collages from
 * the backend's `task.tile` block, the successor of the legacy PNG tiles) and
 * every cell carries a portal hover card with the task's requirements
 * (per-item icons + quantities) and live per-team progress bars — the same
 * `useLiveProgress` map the task board uses, patched from the event SSE
 * channel alongside the cell/revoke completion frames.
 */
import { useMemo, useState } from "react";
import type {
  BingoBoard as BingoBoardData,
  BingoCell,
  BingoCellCompletion,
  EventTask,
  TaskTileIcon,
} from "@droptracker/api-types";
import type { EventProgress } from "@droptracker/api-types";
import { useEventStream } from "@/lib/use-event-stream";
import { LocalTime } from "@/components/local-time";
import {
  TASK_TYPE_LABELS,
  TEAM_COLORS,
  taskConfig,
  taskConfigGroups,
  taskConfigItems,
  taskGoal,
  teamColorMap,
} from "@/lib/events";
import { BingoTile, tileIconUrl } from "@/components/bingo-tile";
import { CARD_SECTION_CLASS, HoverCard } from "@/components/hover-card";
import { TaskProgressBar, useLiveProgress } from "@/components/event-task-progress";

// Re-export for existing importers; canonical home is lib/events.ts now.
export { TEAM_COLORS };

type TeamRef = { id: number; name: string; color?: string | null };

const progressKey = (taskId: number, teamId: number) => `${taskId}:${teamId}`;

function initialCompletions(board: BingoBoardData): Map<number, BingoCellCompletion[]> {
  const map = new Map<number, BingoCellCompletion[]>();
  for (const cell of board.cells) {
    if (cell.completions?.length) {
      map.set(cell.index, [...cell.completions]);
    } else if (cell.completed_by.length) {
      // Legacy payload shape: names only.
      map.set(
        cell.index,
        cell.completed_by.map((name) => ({ team_id: null, team_name: name })),
      );
    }
  }
  return map;
}

/** Case-insensitive item-name → resolved tile icon, for requirement chips. */
function iconByName(task: EventTask | undefined): Map<string, TaskTileIcon> {
  const map = new Map<string, TaskTileIcon>();
  for (const icon of task?.tile?.icons ?? []) {
    if (icon.type === "item") map.set(icon.name.trim().toLowerCase(), icon);
  }
  return map;
}

function ItemChip({ icon, name, suffix }: { icon?: TaskTileIcon; name: string; suffix?: string }) {
  const url = icon ? tileIconUrl(icon) : null;
  return (
    <span className="bg-osrs-bronze/15 border-osrs-bronze/25 text-osrs-parchment-dark/85 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]">
      {url && (
        <img
          src={url}
          alt=""
          className="size-4 object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      {name}
      {suffix && <span className="text-osrs-gold/80">{suffix}</span>}
    </span>
  );
}

/** Requirement chips for item-list tasks: grouped configs render one row per
 * sub-requirement ("All of …", "Any 2 of …"), flat lists render chips with
 * per-item quantity / point suffixes. */
function TaskRequirements({ task }: { task: EventTask }) {
  const icons = iconByName(task);
  const chip = (name: string, suffix?: string) => (
    <ItemChip key={name} icon={icons.get(name.trim().toLowerCase())} name={name} suffix={suffix} />
  );

  const groups = taskConfigGroups(task);
  if (groups.length) {
    return (
      <div className="grid gap-1.5">
        {groups.map((g, gi) => (
          <div key={gi} className="flex flex-wrap items-center gap-1">
            <span className="text-osrs-gold-bright/70 text-[10px] font-semibold uppercase">
              {g.mode === "all_of" ? "All of" : g.need > 1 ? `Any ${g.need} of` : "Any of"}
            </span>
            {g.items.map((name) => chip(name))}
          </div>
        ))}
      </div>
    );
  }

  const items = taskConfigItems(task);
  if (!items.length) return null;
  const isPoints = taskConfig(task).kind === "point_collection";
  const quantities = new Map(
    (task.tile?.icons ?? []).map((icon) => [icon.name.trim().toLowerCase(), icon.quantity]),
  );
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => {
        const qty = quantities.get(it.item_name.trim().toLowerCase());
        const suffix = isPoints
          ? ` ${it.points ?? 1} pt${(it.points ?? 1) === 1 ? "" : "s"}`
          : qty != null && qty > 1
            ? ` ×${qty.toLocaleString()}`
            : undefined;
        return chip(it.item_name, suffix);
      })}
    </div>
  );
}

const MAX_CARD_TEAMS = 6;

/** Hover-card body for one cell: task summary, requirements, live per-team
 * progress, and who completed it when. */
function CellCard({
  cell,
  task,
  teams,
  teamColor,
  progressMap,
  completions,
  viewerTeamId,
}: {
  cell: BingoCell;
  task?: EventTask;
  teams: TeamRef[];
  teamColor: Map<number, string>;
  progressMap: ReturnType<typeof useLiveProgress>;
  completions: BingoCellCompletion[];
  viewerTeamId?: number | null;
}) {
  const orderedTeams =
    viewerTeamId == null
      ? teams
      : [...teams].sort((a, b) => Number(b.id === viewerTeamId) - Number(a.id === viewerTeamId));
  const shownTeams = orderedTeams.slice(0, MAX_CARD_TEAMS);

  return (
    <div className="p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-osrs-gold min-w-0 font-medium">{task?.label ?? cell.label}</span>
        {task != null && task.points > 0 && (
          <span className="text-osrs-gold-bright shrink-0 text-xs tabular-nums">
            {task.points} pts
          </span>
        )}
      </div>

      {task ? (
        <p className="text-osrs-parchment-dark/70 mt-1 text-xs">
          <span className="text-osrs-parchment-dark/50 mr-1 uppercase">
            {TASK_TYPE_LABELS[task.type]}
          </span>
          {taskGoal(task) || null}
        </p>
      ) : (
        <p className="text-osrs-parchment-dark/50 mt-1 text-xs">
          Free cell — completed for every team from the start of the event.
        </p>
      )}

      {task && (taskConfigItems(task).length > 0 || taskConfigGroups(task).length > 0) && (
        <div className={CARD_SECTION_CLASS}>
          <TaskRequirements task={task} />
        </div>
      )}

      {task && teams.length > 0 && (
        <div className={CARD_SECTION_CLASS}>
          <p className="text-osrs-parchment-dark/50 mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
            Team progress
          </p>
          <div className="space-y-1">
            {shownTeams.map((tm) => (
              <TaskProgressBar
                key={tm.id}
                task={task}
                cell={progressMap.get(progressKey(task.id, tm.id))}
                color={teamColor.get(tm.id)}
                label={tm.name + (tm.id === viewerTeamId ? " ★" : "")}
              />
            ))}
            {orderedTeams.length > shownTeams.length && (
              <p className="text-osrs-parchment-dark/40 text-[10px]">
                +{orderedTeams.length - shownTeams.length} more teams
              </p>
            )}
          </div>
        </div>
      )}

      {completions.length > 0 && (
        <div className={CARD_SECTION_CLASS}>
          <p className="text-osrs-parchment-dark/50 mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
            Completed by
          </p>
          <ul className="space-y-0.5 text-xs">
            {completions.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  {c.team_id != null && (
                    <span
                      className="inline-block size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: teamColor.get(c.team_id) ?? "#999" }}
                      aria-hidden
                    />
                  )}
                  <span className="truncate">{c.team_name ?? c.player_name ?? "Unknown"}</span>
                  {c.player_name && c.team_name && (
                    <span className="text-osrs-parchment-dark/50 truncate">by {c.player_name}</span>
                  )}
                </span>
                {c.completed_at != null && (
                  <span className="text-osrs-parchment-dark/40 shrink-0">
                    <LocalTime unix={c.completed_at} mode="date" />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function BingoBoard({
  board,
  teams = [],
  tasks = [],
  eventId,
  live = false,
  progress,
  viewerTeamId,
}: {
  board: BingoBoardData;
  teams?: TeamRef[];
  tasks?: EventTask[];
  eventId?: number;
  /** Subscribe to the event SSE channel and patch completions in place. */
  live?: boolean;
  /** Per-(task, team) rollups from the event detail — powers the hover cards'
   * progress bars (patched live like the task board). */
  progress?: EventProgress[];
  /** The signed-in viewer's team — pinned first in hover-card progress. */
  viewerTeamId?: number | null;
}) {
  const [completions, setCompletions] = useState(() => initialCompletions(board));
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);

  const teamName = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);
  const teamColor = useMemo(() => teamColorMap(teams), [teams]);
  const taskByCell = useMemo(() => {
    const map = new Map<number, EventTask>();
    for (const cell of board.cells) {
      if (cell.task_id != null) {
        const task = tasks.find((t) => t.id === cell.task_id);
        if (task) map.set(cell.index, task);
      }
    }
    return map;
  }, [board.cells, tasks]);

  const progressMap = useLiveProgress(eventId, live, progress);

  useEventStream(live && eventId ? [`event:${eventId}`] : [], (event) => {
    if (event.type !== "event_update") return;
    const data = event.data as {
      kind?: string;
      cell_idx?: number;
      task_id?: number | null;
      team_id?: number | null;
      player_name?: string;
      bonus?: string;
    };
    if (data.kind === "cell" && typeof data.cell_idx === "number") {
      const idx = data.cell_idx;
      const teamId = typeof data.team_id === "number" ? data.team_id : null;
      setCompletions((prev) => {
        const existing = prev.get(idx) ?? [];
        if (teamId != null && existing.some((c) => c.team_id === teamId)) return prev;
        const next = new Map(prev);
        next.set(idx, [
          ...existing,
          {
            team_id: teamId,
            team_name: teamId != null ? (teamName.get(teamId) ?? `Team ${teamId}`) : null,
            player_name: data.player_name ?? null,
            completed_at: Math.floor(Date.now() / 1000),
          },
        ]);
        return next;
      });
    } else if (data.kind === "revoke" && typeof data.task_id === "number" && !data.bonus) {
      // A revoked task completion clears that team's cells bound to the task.
      const teamId = typeof data.team_id === "number" ? data.team_id : null;
      if (teamId == null) return;
      const affected = board.cells.filter((c) => c.task_id === data.task_id).map((c) => c.index);
      if (!affected.length) return;
      setCompletions((prev) => {
        const next = new Map(prev);
        for (const idx of affected) {
          const kept = (next.get(idx) ?? []).filter((c) => c.team_id !== teamId);
          if (kept.length) next.set(idx, kept);
          else next.delete(idx);
        }
        return next;
      });
    }
  });

  const cellDone = (idx: number): boolean => {
    const list = completions.get(idx) ?? [];
    if (selectedTeam == null) return list.length > 0;
    return list.some((c) => c.team_id === selectedTeam);
  };

  return (
    <div className="space-y-3">
      {teams.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => setSelectedTeam(null)}
            className={`rounded px-2 py-1 ${
              selectedTeam == null
                ? "bg-osrs-bronze/30 text-osrs-gold-bright"
                : "text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
            }`}
          >
            All teams
          </button>
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTeam(selectedTeam === t.id ? null : t.id)}
              className={`flex items-center gap-1.5 rounded px-2 py-1 ${
                selectedTeam === t.id
                  ? "bg-osrs-bronze/30 text-osrs-gold-bright"
                  : "text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
              }`}
            >
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: teamColor.get(t.id) }}
                aria-hidden
              />
              {t.name}
            </button>
          ))}
        </div>
      )}

      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))` }}
      >
        {board.cells.map((cell) => {
          const list = completions.get(cell.index) ?? [];
          const done = cellDone(cell.index);
          const task = taskByCell.get(cell.index);
          const free = cell.task_id == null;
          const doneTeams = list
            .filter((c) => c.team_id != null)
            .map((c) => c.team_id as number);
          return (
            <HoverCard
              key={cell.index}
              className="block min-w-0"
              content={
                <CellCard
                  cell={cell}
                  task={task}
                  teams={teams}
                  teamColor={teamColor}
                  progressMap={progressMap}
                  completions={list}
                  viewerTeamId={viewerTeamId}
                />
              }
            >
              <div
                className={`relative flex aspect-square cursor-pointer flex-col rounded border transition-colors ${
                  done
                    ? "border-osrs-green/60 bg-osrs-green/15 text-osrs-parchment"
                    : "border-osrs-bronze/30 bg-osrs-brown-dark/40 text-osrs-parchment-dark/80 hover:border-osrs-bronze/60"
                }`}
              >
                <BingoTile label={cell.label} task={task} free={free} />
                {done && (
                  <span
                    className="text-osrs-green absolute top-0.5 left-1 text-[11px] font-bold"
                    style={{ textShadow: "1px 1px 0 #000" }}
                  >
                    ✓
                  </span>
                )}
                {selectedTeam == null && doneTeams.length > 0 && teams.length > 0 && (
                  <span className="absolute right-1 bottom-1 flex gap-0.5">
                    {doneTeams.slice(0, 4).map((id) => (
                      <span
                        key={id}
                        className="inline-block size-1.5 rounded-full"
                        style={{ backgroundColor: teamColor.get(id) ?? "#999" }}
                        title={teamName.get(id)}
                        aria-hidden
                      />
                    ))}
                  </span>
                )}
              </div>
            </HoverCard>
          );
        })}
      </div>
    </div>
  );
}
