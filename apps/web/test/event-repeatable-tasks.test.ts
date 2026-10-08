/**
 * Repeatable event tasks: the client mirror of the backend's
 * utils/task_repeat.py. Which task shapes may repeat, which event kinds honour
 * the flag, and the badge copy.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { EventTask } from "@droptracker/api-types";
import { repeatBadge, repeatEligible, taskRepeat } from "@/lib/events";

const task = (type: EventTask["type"], config: Record<string, unknown> | null) =>
  ({ type, config: config ? JSON.stringify(config) : null }) as Pick<EventTask, "type" | "config">;

test("count-style tasks can repeat", () => {
  for (const type of ["kc_target", "xp_target", "loot_value", "pet_collection", "custom"]) {
    assert.equal(repeatEligible({ type }), true, type);
  }
  assert.equal(repeatEligible({ type: "item_collection", itemMode: "single" }), true);
  assert.equal(repeatEligible({ type: "item_collection", itemMode: "any_of" }), true);
  assert.equal(repeatEligible({ type: "item_collection", itemMode: "point_collection" }), true);
  assert.equal(repeatEligible({ type: "pb_target", pbMode: "times" }), true);
});

test("sets, levels and unique-player goals finish once", () => {
  for (const itemMode of ["all_of", "assembly", "any_of_distinct", "groups", "any_path"]) {
    assert.equal(repeatEligible({ type: "item_collection", itemMode }), false, itemMode);
  }
  assert.equal(repeatEligible({ type: "pb_target", pbMode: "unique_players" }), false);
  assert.equal(repeatEligible({ type: "pb_target", pbMode: "whole_team" }), false);
  assert.equal(repeatEligible({ type: "skill_target" }), false);
  assert.equal(repeatEligible({ type: "loot_sweep" }), false);
});

test("taskRepeat reads the flag and cap on standard events only", () => {
  const zulrah = task("loot_value", { source_npcs: ["Zulrah"], repeatable: true });
  assert.deepEqual(taskRepeat(zulrah, "standard"), { max: null });
  assert.deepEqual(taskRepeat(zulrah, undefined), { max: null });
  assert.equal(taskRepeat(zulrah, "bingo"), null);
  assert.equal(taskRepeat(zulrah, "board_game"), null);
  const capped = task("kc_target", { repeatable: true, max_completions: 5 });
  assert.deepEqual(taskRepeat(capped, "standard"), { max: 5 });
  assert.equal(taskRepeat(task("kc_target", null), "standard"), null);
  // A stored flag on a shape that cannot repeat is inert.
  assert.equal(
    taskRepeat(task("item_collection", { kind: "all_of", repeatable: true }), "standard"),
    null,
  );
});

test("badge copy", () => {
  assert.equal(repeatBadge({ max: null }), "Repeatable");
  assert.equal(repeatBadge({ max: 3 }), "Repeatable, up to 3×");
});
