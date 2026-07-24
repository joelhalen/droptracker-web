import assert from "node:assert/strict";
import { test } from "node:test";
import { EventSummarySchema } from "@droptracker/api-types";
import { isForwardOnlyTask, taskScoringDirty } from "../lib/event-live-edit";

// ── isForwardOnlyTask: which live edits can never be recomputed ──────────────

test("manual-only task types are forward-only", () => {
  for (const t of ["custom", "ehp_target", "ehb_target"]) {
    assert.equal(isForwardOnlyTask(t), true, t);
  }
});

test("auto-evaluated types are recomputable on standard events", () => {
  for (const t of ["kc_target", "xp_target", "item_collection", "loot_value", "pb_target"]) {
    assert.equal(isForwardOnlyTask(t), false, t);
    assert.equal(isForwardOnlyTask(t, "bingo"), false, t);
  }
});

test("every task on a board-game event is forward-only", () => {
  assert.equal(isForwardOnlyTask("kc_target", "board_game"), true);
  assert.equal(isForwardOnlyTask("item_collection", "board_game"), true);
});

// ── taskScoringDirty: which edits demand the retro choice ────────────────────

const base = { target: "Zulrah", target_value: 5, points: 10, config: null };

test("identical fields are not dirty", () => {
  assert.equal(taskScoringDirty({ ...base }, { ...base }), false);
});

test("goal, points, and config changes are dirty", () => {
  assert.equal(taskScoringDirty({ ...base, target_value: 6 }, base), true);
  assert.equal(taskScoringDirty({ ...base, target: "Vorkath" }, base), true);
  assert.equal(taskScoringDirty({ ...base, points: 25 }, base), true);
  assert.equal(taskScoringDirty({ ...base, config: '{"kind":"any_of"}' }, base), true);
});

test("null/undefined/default normalization does not false-positive", () => {
  // undefined vs null target/config and absent points vs 0 mean "unchanged".
  assert.equal(
    taskScoringDirty(
      { target: undefined, target_value: undefined, points: undefined, config: undefined },
      { target: null, target_value: null, points: 0, config: null },
    ),
    false,
  );
});

// ── Contract: allow_live_edits defaults false on legacy payloads ─────────────

test("EventSummarySchema defaults allow_live_edits for pre-web68a payloads", () => {
  const legacy = EventSummarySchema.parse({
    id: 1,
    group_id: null,
    name: "Old Event",
    status: "active",
    starts_at: null,
    ends_at: null,
  });
  assert.equal(legacy.allow_live_edits, false);
  const flagged = EventSummarySchema.parse({
    id: 2,
    group_id: null,
    name: "Live-editable",
    status: "active",
    starts_at: null,
    ends_at: null,
    allow_live_edits: true,
  });
  assert.equal(flagged.allow_live_edits, true);
});
