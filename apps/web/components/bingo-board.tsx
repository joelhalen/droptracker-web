"use client";

/**
 * Public bingo board (FRONTEND_PLAN.md §14.1, upgraded by Task 20 B3, tile
 * art + hover cards by the tile-resurrection pass, per-team item breakdown by
 * the task-detail pass).
 *
 * Cells render rich tile art (`BingoTile` — item/npc/skill icon collages from
 * the backend's `task.tile` block) and each cell opens a task detail surface:
 * on desktop an in-place hover card, on touch a bottom sheet. Both show the
 * shared `TaskDetailContent` — the selected team's item-level "have / need"
 * checklist, contributors, and an all-teams comparison — plus who has
 * completed the cell. Completions patch live from the event SSE channel.
 */
import { useMemo, useState } from "react";
import type {
  BingoBoard as BingoBoardData,
  BingoCell,
  BingoCellCompletion,
  EventTask,
} from "@droptracker/api-types";
import type { EventProgress } from "@droptracker/api-types";
import { useEventStream } from "@/lib/use-event-stream";
import { LocalTime } from "@/components/local-time";
import { TASK_TYPE_LABELS, TEAM_COLORS, taskGoal, teamColorMap } from "@/lib/events";
import { BingoTile } from "@/components/bingo-tile";
import { CARD_SECTION_CLASS, HoverCard } from "@/components/hover-card";
import { useLiveProgress } from "@/components/event-task-progress";
import {
  TaskDetailContent,
  TaskDetailSheet,
  useCoarsePointer,
  type BreakdownFetcher,
} from "@/components/task-detail";

// Re-export for existing importers; canonical home is lib/events.ts now.
export { TEAM_COLORS };

type TeamRef = { id: number; name: string; color?: string | null };

/** Wider than the default hover card — the detail card holds a checklist,
 * team switcher, and contributors. */
const TASK_CARD_WIDTH = 340;

/** Pending-review overlay for one cell (web53a): teams whose queued
 * submissions would FINISH the cell ("complete") vs. teams with only some
 * parts pending ("partial"). */
type CellPending = { complete: Set<number>; partial: Set<number> };

function initialPending(board: BingoBoardData): Map<number, CellPending> {
  const map = new Map<number, CellPending>();
  for (const cell of board.cells) {
    if (cell.pending_teams?.length || cell.pending_partial_teams?.length) {
      map.set(cell.index, {
        complete: new Set(cell.pending_teams ?? []),
        partial: new Set(cell.pending_partial_teams ?? []),
      });
    }
  }
  return map;
}

/** Drop `teamId` from a cell's pending sets, pruning empty entries. */
function clearTeamPending(
  prev: Map<number, CellPending>,
  indexes: number[],
  teamId: number,
): Map<number, CellPending> {
  let next: Map<number, CellPending> | null = null;
  for (const idx of indexes) {
    const cur = (next ?? prev).get(idx);
    if (!cur || (!cur.complete.has(teamId) && !cur.partial.has(teamId))) continue;
    next ??= new Map(prev);
    const complete = new Set(cur.complete);
    const partial = new Set(cur.partial);
    complete.delete(teamId);
    partial.delete(teamId);
    if (complete.size || partial.size) next.set(idx, { complete, partial });
    else next.delete(idx);
  }
  return next ?? prev;
}

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

/** Who has completed this cell, and when. */
function CompletedBy({
  completions,
  teamColor,
}: {
  completions: BingoCellCompletion[];
  teamColor: Map<number, string>;
}) {
  return (
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
  );
}

/** Hover-card / sheet body for one cell: task summary, the per-team item
 * breakdown, and who has completed the cell. */
function CellCard({
  cell,
  task,
  teams,
  teamColor,
  progressMap,
  completions,
  pendingState,
  viewerTeamId,
  eventId,
  fetchBreakdown,
}: {
  cell: BingoCell;
  task?: EventTask;
  teams: TeamRef[];
  teamColor: Map<number, string>;
  progressMap: ReturnType<typeof useLiveProgress>;
  completions: BingoCellCompletion[];
  /** Pending-review overlay for the current team filter (web53a). */
  pendingState?: "complete" | "partial" | null;
  viewerTeamId?: number | null;
  eventId?: number;
  fetchBreakdown?: BreakdownFetcher;
}) {
  return (
    <div className="p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-osrs-gold min-w-0 font-medium">{task?.label ?? cell.label}</span>
        {task != null && task.points > 0 && (
          <span className="text-osrs-gold-bright shrink-0 text-xs tabular-nums">{task.points} pts</span>
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

      {pendingState === "complete" && (
        <p className="mt-1 text-xs text-amber-400">Awaiting review — confirming would finish this tile.</p>
      )}
      {pendingState === "partial" && (
        <p className="mt-1 text-xs text-amber-400/80">Part of this tile is awaiting review.</p>
      )}

      {task && eventId != null && (
        <div className={CARD_SECTION_CLASS}>
          <TaskDetailContent
            eventId={eventId}
            task={task}
            teams={teams}
            teamColor={teamColor}
            progressMap={progressMap}
            viewerTeamId={viewerTeamId}
            fetchBreakdown={fetchBreakdown}
          />
        </div>
      )}

      {completions.length > 0 && <CompletedBy completions={completions} teamColor={teamColor} />}
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
  fetchBreakdown,
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
  /** The signed-in viewer's team — pinned first in the detail card. */
  viewerTeamId?: number | null;
  /** Host transport for the per-team breakdown; omit for the site cookie BFF. */
  fetchBreakdown?: BreakdownFetcher;
}) {
  const [completions, setCompletions] = useState(() => initialCompletions(board));
  const [pending, setPending] = useState(() => initialPending(board));
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [sheetIdx, setSheetIdx] = useState<number | null>(null);
  const coarse = useCoarsePointer();

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
      pending?: number;
      pending_complete?: boolean;
      bonus?: string;
    };
    if (data.kind === "cell" && typeof data.cell_idx === "number") {
      const idx = data.cell_idx;
      const teamId = typeof data.team_id === "number" ? data.team_id : null;
      // A confirmed completion supersedes any pending overlay — green wins.
      if (teamId != null) setPending((prev) => clearTeamPending(prev, [idx], teamId));
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
    } else if (data.kind === "pending" && typeof data.task_id === "number") {
      // Pending-review overlay frame (web53a) — emitted when a submission
      // lands in the review queue and again after a confirm/reject (where the
      // count may drop to 0, clearing the overlay).
      const teamId = typeof data.team_id === "number" ? data.team_id : null;
      if (teamId == null) return;
      const affected = board.cells.filter((c) => c.task_id === data.task_id).map((c) => c.index);
      if (!affected.length) return;
      const count = typeof data.pending === "number" ? data.pending : 0;
      const wouldFinish = data.pending_complete === true && count > 0;
      setPending((prev) => {
        if (count === 0) return clearTeamPending(prev, affected, teamId);
        const next = new Map(prev);
        for (const idx of affected) {
          const cur = next.get(idx);
          const complete = new Set(cur?.complete ?? []);
          const partial = new Set(cur?.partial ?? []);
          complete.delete(teamId);
          partial.delete(teamId);
          (wouldFinish ? complete : partial).add(teamId);
          next.set(idx, { complete, partial });
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

  /** Pending-review visual state for a cell, honoring the team filter. Done
   * always wins; "all teams" goes amber when ANY team is pending-complete. */
  const cellPending = (idx: number): "complete" | "partial" | null => {
    if (cellDone(idx)) return null;
    const p = pending.get(idx);
    if (!p) return null;
    if (selectedTeam == null) {
      if (p.complete.size > 0) return "complete";
      return p.partial.size > 0 ? "partial" : null;
    }
    if (p.complete.has(selectedTeam)) return "complete";
    return p.partial.has(selectedTeam) ? "partial" : null;
  };

  /** Detail body for a cell — shared by the desktop hover card and the sheet. */
  const cellCard = (cell: BingoCell) => (
    <CellCard
      cell={cell}
      task={taskByCell.get(cell.index)}
      teams={teams}
      teamColor={teamColor}
      progressMap={progressMap}
      completions={completions.get(cell.index) ?? []}
      pendingState={cellPending(cell.index)}
      viewerTeamId={viewerTeamId}
      eventId={eventId}
      fetchBreakdown={fetchBreakdown}
    />
  );

  const sheetCell = sheetIdx != null ? board.cells.find((c) => c.index === sheetIdx) : undefined;

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
          // Pending-review overlay: done > pending-complete (amber) > partial
          // (default look + amber corner dot) > default.
          const pend = cellPending(cell.index);
          const task = taskByCell.get(cell.index);
          const free = cell.task_id == null;
          const doneTeams = list.filter((c) => c.team_id != null).map((c) => c.team_id as number);
          const tile = (
            <div
              className={`relative flex aspect-square cursor-pointer flex-col rounded border transition-colors ${
                done
                  ? "border-osrs-green/60 bg-osrs-green/15 text-osrs-parchment"
                  : pend === "complete"
                    ? "border-amber-400/70 bg-amber-500/15 text-osrs-parchment hover:border-amber-400/90"
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
              {!done && pend === "complete" && (
                <span
                  className="absolute top-0.5 left-1 text-[10px]"
                  style={{ textShadow: "1px 1px 0 #000" }}
                  title="Done — awaiting review"
                  aria-label="Done — awaiting review"
                >
                  ⏳
                </span>
              )}
              {!done && pend === "partial" && (
                <span
                  className="absolute top-1 right-1 inline-block size-1.5 rounded-full bg-amber-400/90"
                  title="Part of this tile is awaiting review"
                  aria-label="Part of this tile is awaiting review"
                />
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
          );

          // Touch: tap opens a bottom sheet. Pointer: in-place hover card.
          if (coarse) {
            return (
              <button
                key={cell.index}
                type="button"
                className="block min-w-0 text-left"
                onClick={() => setSheetIdx(cell.index)}
              >
                {tile}
              </button>
            );
          }
          return (
            <HoverCard key={cell.index} className="block min-w-0" width={TASK_CARD_WIDTH} content={cellCard(cell)}>
              {tile}
            </HoverCard>
          );
        })}
      </div>

      {coarse && (
        <TaskDetailSheet open={sheetCell != null} onClose={() => setSheetIdx(null)}>
          {sheetCell && cellCard(sheetCell)}
        </TaskDetailSheet>
      )}
    </div>
  );
}
