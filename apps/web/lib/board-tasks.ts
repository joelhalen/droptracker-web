/**
 * Board-game task bookkeeping shared by the review tab and the designers.
 *
 * A landing clones the tile's task into a per-team INSTANCE
 * (`config.board_instance`, see services/boardgame_engine._materialize_instance).
 * Only that instance moves the team's piece, and it carries the original's
 * label, so a plain task list shows the same name several times. These
 * helpers tell the two apart and label tasks by the tile they sit on.
 */
import type { BoardTile, EventTask } from "@droptracker/api-types";
import { taskConfig } from "@/lib/events";

export type BoardInstanceInfo = {
  sourceTaskId: number | null;
  teamId: number | null;
  tileIdx: number | null;
};

const int = (v: unknown): number | null =>
  typeof v === "number" && Number.isInteger(v) ? v : null;

/** The instance markers on a task, or null for an ordinary task. */
export function boardInstanceInfo(task: Pick<EventTask, "config">): BoardInstanceInfo | null {
  const cfg = taskConfig(task);
  if (!cfg.board_instance) return null;
  return {
    sourceTaskId: int(cfg.source_task_id),
    teamId: int(cfg.team_id),
    tileIdx: int(cfg.tile_idx),
  };
}

export const isBoardInstance = (task: Pick<EventTask, "config">): boolean =>
  boardInstanceInfo(task) !== null;

/** "#37" style tags: originals by the tile(s) that pin them, instances by the
 * tile they were drawn for. Tasks on no tile get no tag. */
export function boardTileTags(
  tasks: EventTask[],
  tiles: Pick<BoardTile, "idx" | "task_id">[],
): Map<number, string> {
  const byTask = new Map<number, number[]>();
  for (const t of tiles) {
    if (t.task_id == null) continue;
    const list = byTask.get(t.task_id) ?? [];
    list.push(t.idx);
    byTask.set(t.task_id, list);
  }
  const tags = new Map<number, string>();
  for (const task of tasks) {
    const inst = boardInstanceInfo(task);
    const idxs = inst
      ? inst.tileIdx != null
        ? [inst.tileIdx]
        : []
      : (byTask.get(task.id) ?? []).sort((a, b) => a - b);
    if (idxs.length) tags.set(task.id, idxs.map((i) => `#${i}`).join(", "));
  }
  return tags;
}

/** One placeable spot on an event's board: a dice-board tile or a bingo cell.
 * The designers report these up so the task form can offer "place on tile". */
export type BoardSlot = {
  idx: number;
  /** "#37" for a tile, "Row 2, column 3" for a bingo cell. */
  name: string;
  /** The task pinned there now, if any. */
  taskId: number | null;
  /** Holds nothing at all (no task, tier or library pick). */
  empty: boolean;
};

export type BoardLayoutSummary = {
  kind: "board" | "bingo";
  /** Whether the designer can take edits right now (layout not locked). */
  editable: boolean;
  slots: BoardSlot[];
};

/** Ask a designer to pin a task to one of its slots. `nonce` makes a repeat
 * request for the same slot distinct. */
export type BoardPinRequest = { idx: number; taskId: number; nonce: number };

export const bingoCellName = (idx: number, size: number): string =>
  `Row ${Math.floor(idx / size) + 1}, column ${(idx % size) + 1}`;
