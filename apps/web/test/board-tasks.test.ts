/**
 * Board-game task bookkeeping (suggestion #200): per-team instances are told
 * apart from the originals they were cloned from, and tasks are tagged by the
 * tile they sit on so the award picker and the tile list can show "#37".
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { EventTask } from "@droptracker/api-types";
import { bingoCellName, boardInstanceInfo, boardTileTags, isBoardInstance } from "@/lib/board-tasks";

const task = (id: number, config: Record<string, unknown> | null = null) =>
  ({ id, label: `Task ${id}`, config: config ? JSON.stringify(config) : null }) as EventTask;

const instance = (id: number, source: number, team: number, tile: number) =>
  task(id, { kind: "any_of", board_instance: true, source_task_id: source, team_id: team, tile_idx: tile });

test("instance markers are read off the config", () => {
  assert.deepEqual(boardInstanceInfo(instance(88, 20, 3, 37)), {
    sourceTaskId: 20,
    teamId: 3,
    tileIdx: 37,
  });
  assert.equal(boardInstanceInfo(task(20, { kind: "any_of" })), null);
  assert.equal(isBoardInstance(task(21)), false);
  assert.equal(isBoardInstance({ config: "not json" }), false);
});

test("originals are tagged by their pinned tiles, instances by their drawn tile", () => {
  const tags = boardTileTags(
    [task(20), task(21), task(22), instance(88, 20, 3, 37)],
    [
      { idx: 40, task_id: 20 },
      { idx: 12, task_id: 20 },
      { idx: 5, task_id: 21 },
      { idx: 6, task_id: null },
    ],
  );
  assert.equal(tags.get(20), "#12, #40");
  assert.equal(tags.get(21), "#5");
  assert.equal(tags.has(22), false);
  assert.equal(tags.get(88), "#37");
});

test("bingo cells are named by row and column", () => {
  assert.equal(bingoCellName(0, 5), "Row 1, column 1");
  assert.equal(bingoCellName(7, 5), "Row 2, column 3");
});
