"use client";

/**
 * The board designer's List view (suggestion #200): every tile as a row, so a
 * numbered board can be filled in order without clicking into each tile on
 * the canvas. Edits go through the designer's own tile patch (undo + autosave
 * included); anything the row can't show opens the full tile editor.
 */
import { useMemo, useState } from "react";
import type { EventTask, EventTaskDifficulty } from "@droptracker/api-types";
import { EVENT_TASK_DIFFICULTIES } from "@droptracker/api-types";
import { TASK_DIFFICULTY_LABELS } from "@/lib/events";
import { boardTileTags } from "@/lib/board-tasks";
import { EventTaskCombobox } from "@/components/event-task-search";

export type TileListRow = {
  label: string;
  difficulty: EventTaskDifficulty | null;
  taskId: number | null;
  tileKind: "start" | "normal" | "required" | "finish";
  jumpTo: number | null;
};

const KIND_LABELS: Record<TileListRow["tileKind"], string> = {
  start: "Start",
  normal: "",
  required: "Required stop",
  finish: "Finish",
};

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-2 py-1.5 text-sm outline-none disabled:opacity-50";

export function BoardTileList({
  tiles,
  tasks,
  editable,
  onChange,
  onOpen,
}: {
  tiles: TileListRow[];
  tasks: EventTask[];
  editable: boolean;
  onChange: (idx: number, patch: Partial<TileListRow>) => void;
  /** Open the full tile editor for this tile (links, kind, points). */
  onOpen: (idx: number) => void;
}) {
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  // Which tiles already pin each task, so a duplicate pin is visible in the
  // picker ("#12" next to a task that sits on tile 12).
  const tags = useMemo(
    () => boardTileTags(tasks, tiles.map((t, idx) => ({ idx, task_id: t.taskId }))),
    [tasks, tiles],
  );
  const assigned = tiles.filter((t) => t.taskId != null || t.difficulty).length;
  const unplaced = tasks.filter((t) => !tags.has(t.id)).length;
  const rows = tiles
    .map((tile, idx) => ({ tile, idx }))
    .filter(({ tile }) => !onlyEmpty || (tile.taskId == null && !tile.difficulty));

  return (
    <div className="space-y-2">
      <div className="text-osrs-parchment-dark/70 flex flex-wrap items-center gap-3 text-xs">
        <span>
          {assigned} of {tiles.length} tiles have a task
          {unplaced > 0 && ` · ${unplaced} task${unplaced === 1 ? "" : "s"} not on any tile yet`}
        </span>
        <label className="ml-auto flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={onlyEmpty}
            onChange={(e) => setOnlyEmpty(e.target.checked)}
          />
          Only tiles without a task
        </label>
      </div>

      <div className="text-osrs-parchment-dark/50 hidden grid-cols-[3.5rem_minmax(0,1fr)_9rem_minmax(0,12rem)_4rem] gap-2 px-1 text-[11px] uppercase sm:grid">
        <span>Tile</span>
        <span>Pinned task</span>
        <span>Or roll a tier</span>
        <span>Label</span>
        <span />
      </div>
      <ul className="divide-osrs-bronze/20 divide-y">
        {rows.map(({ tile, idx }) => (
          <li
            key={idx}
            className="grid grid-cols-1 gap-2 py-2 sm:grid-cols-[3.5rem_minmax(0,1fr)_9rem_minmax(0,12rem)_4rem] sm:items-center"
          >
            <span className="text-sm">
              <span className="text-osrs-gold font-semibold">#{idx}</span>
              {KIND_LABELS[tile.tileKind] && (
                <span className="text-osrs-parchment-dark/60 block text-[11px]">
                  {KIND_LABELS[tile.tileKind]}
                </span>
              )}
              {tile.jumpTo != null && (
                <span className="text-osrs-parchment-dark/60 block text-[11px]">
                  {tile.jumpTo > idx ? "Ladder" : "Chute"} to #{tile.jumpTo}
                </span>
              )}
            </span>
            <EventTaskCombobox
              tasks={tasks}
              value={tile.taskId}
              disabled={!editable}
              tags={tags}
              onChange={(taskId) =>
                onChange(idx, taskId != null ? { taskId, difficulty: null } : { taskId: null })
              }
              placeholder="Find a task"
              clearLabel="Unpin"
            />
            <select
              value={tile.taskId != null ? "" : (tile.difficulty ?? "")}
              disabled={!editable}
              onChange={(e) =>
                onChange(idx, {
                  difficulty: (e.target.value || null) as EventTaskDifficulty | null,
                  taskId: null,
                })
              }
              aria-label={`Tile ${idx} difficulty`}
              className={field}
            >
              <option value="">{tile.taskId != null ? "Pinned" : "Rest tile"}</option>
              {EVENT_TASK_DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {TASK_DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </select>
            <input
              value={tile.label}
              disabled={!editable}
              onChange={(e) => onChange(idx, { label: e.target.value })}
              placeholder="Label (optional)"
              maxLength={255}
              aria-label={`Tile ${idx} label`}
              className={field}
            />
            <button
              type="button"
              onClick={() => onOpen(idx)}
              className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-xs"
              title="Open this tile on the board for links, tile type and points"
            >
              Open
            </button>
          </li>
        ))}
      </ul>
      {rows.length === 0 && (
        <p className="text-osrs-parchment-dark/60 text-sm">
          {tiles.length ? "Every tile has a task." : "No tiles yet. Generate a board or add tiles first."}
        </p>
      )}
    </div>
  );
}
