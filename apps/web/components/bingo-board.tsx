"use client";

/**
 * Public bingo board (FRONTEND_PLAN.md §14.1, upgraded by Task 20 B3).
 * Per-team completion overlay (team selector pills + colored dots in
 * all-teams mode), a cell detail popover (task, who completed it, when), and
 * live updates from the event SSE channel (`rt:event:{id}` → kind
 * cell/revoke frames are patched into local state, like the live drop ticker
 * consumes the "feed" scope).
 */
import { useMemo, useState } from "react";
import type {
  BingoBoard as BingoBoardData,
  BingoCellCompletion,
  EventTask,
} from "@droptracker/api-types";
import { useEventStream } from "@/lib/use-event-stream";
import { LocalTime } from "@/components/local-time";
import { TASK_TYPE_LABELS, taskGoal } from "@/lib/events";

type TeamRef = { id: number; name: string };

/** Stable per-team accent colors, shared with the task progress board and
 * team pages so a team keeps one color across every event surface. */
export const TEAM_COLORS = [
  "#e05c4c", // red
  "#4c8fe0", // blue
  "#4cb96b", // green
  "#e0b34c", // gold
  "#a05ce0", // purple
  "#e07f4c", // orange
  "#4cc9c0", // teal
  "#e05ca8", // pink
];

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

export function BingoBoard({
  board,
  teams = [],
  tasks = [],
  eventId,
  live = false,
}: {
  board: BingoBoardData;
  teams?: TeamRef[];
  tasks?: EventTask[];
  eventId?: number;
  /** Subscribe to the event SSE channel and patch completions in place. */
  live?: boolean;
}) {
  const [completions, setCompletions] = useState(() => initialCompletions(board));
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);

  const teamName = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);
  const teamColor = useMemo(
    () => new Map(teams.map((t, i) => [t.id, TEAM_COLORS[i % TEAM_COLORS.length]!])),
    [teams],
  );
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

  const selected = selectedCell != null ? board.cells.find((c) => c.index === selectedCell) : null;
  const selectedCompletions = selectedCell != null ? (completions.get(selectedCell) ?? []) : [];
  const selectedTask = selectedCell != null ? taskByCell.get(selectedCell) : undefined;

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
          const isSelected = selectedCell === cell.index;
          const doneTeams = list
            .filter((c) => c.team_id != null)
            .map((c) => c.team_id as number);
          return (
            <button
              key={cell.index}
              onClick={() => setSelectedCell(isSelected ? null : cell.index)}
              title={
                list.length
                  ? `Completed by ${list.map((c) => c.team_name ?? c.player_name ?? "?").join(", ")}`
                  : cell.label
              }
              className={`relative flex aspect-square flex-col items-center justify-center rounded border p-1 text-center text-[11px] leading-tight transition-colors ${
                done
                  ? "border-osrs-green/60 bg-osrs-green/15 text-osrs-parchment"
                  : "border-osrs-bronze/30 bg-osrs-brown-dark/40 text-osrs-parchment-dark/80"
              } ${isSelected ? "ring-osrs-gold ring-1" : ""}`}
            >
              <span className="line-clamp-3">{cell.label}</span>
              {done && <span className="text-osrs-green mt-0.5 text-[10px]">✓</span>}
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
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="border-osrs-bronze/30 space-y-2 rounded border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-osrs-gold font-medium">{selected.label}</span>
            <button
              onClick={() => setSelectedCell(null)}
              className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs"
            >
              Close
            </button>
          </div>
          {selectedTask ? (
            <p className="text-osrs-parchment-dark/70 text-xs">
              <span className="text-osrs-parchment-dark/50 mr-1 uppercase">
                {TASK_TYPE_LABELS[selectedTask.type]}
              </span>
              {selectedTask.label}
              {taskGoal(selectedTask) && <span> — {taskGoal(selectedTask)}</span>}
              {selectedTask.points > 0 && (
                <span className="text-osrs-gold-bright ml-2">{selectedTask.points} pts</span>
              )}
            </p>
          ) : (
            <p className="text-osrs-parchment-dark/50 text-xs">
              Free cell — completed for every team from the start of the event.
            </p>
          )}
          {selectedCompletions.length ? (
            <ul className="space-y-0.5 text-xs">
              {selectedCompletions.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    {c.team_id != null && (
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ backgroundColor: teamColor.get(c.team_id) ?? "#999" }}
                        aria-hidden
                      />
                    )}
                    <span>{c.team_name ?? c.player_name ?? "Unknown"}</span>
                    {c.player_name && c.team_name && (
                      <span className="text-osrs-parchment-dark/50">by {c.player_name}</span>
                    )}
                  </span>
                  {c.completed_at != null && (
                    <span className="text-osrs-parchment-dark/40">
                      <LocalTime unix={c.completed_at} mode="date" />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-osrs-parchment-dark/50 text-xs">Not completed by any team yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
