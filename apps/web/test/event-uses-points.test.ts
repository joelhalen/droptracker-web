import { test } from "node:test";
import assert from "node:assert/strict";
import { eventUsesPoints } from "../lib/events";

const base = {
  kind: "bingo",
  tasks: [{ points: 0 }, { points: 0 }],
  teams: [{ score: 0 }, { score: 0 }],
  tasks_hidden: false,
  bonus_line_points: 0,
  bonus_blackout_points: 0,
};

test("an all-zero checklist event does not use points", () => {
  assert.equal(eventUsesPoints(base), false);
  assert.equal(eventUsesPoints({ ...base, kind: "standard" }), false);
});

test("any task worth points turns them on", () => {
  assert.equal(eventUsesPoints({ ...base, tasks: [{ points: 0 }, { points: 5 }] }), true);
});

test("bingo line or blackout bonuses count as points", () => {
  assert.equal(eventUsesPoints({ ...base, bonus_line_points: 10 }), true);
  assert.equal(eventUsesPoints({ ...base, bonus_blackout_points: 50 }), true);
});

test("a non-zero team score (manual award) keeps points on", () => {
  assert.equal(eventUsesPoints({ ...base, teams: [{ score: 0 }, { score: 3 }] }), true);
  assert.equal(eventUsesPoints({ ...base, teams: [{ score: -2 }] }), true);
});

test("hidden or missing tasks keep points on (nothing to judge by)", () => {
  assert.equal(eventUsesPoints({ ...base, tasks: [], tasks_hidden: true }), true);
  assert.equal(eventUsesPoints({ ...base, tasks: [] }), true);
});

test("kinds that score by their own mechanics always use points", () => {
  for (const kind of ["board_game", "loot_sweep", "conquest", "sotw", "botw"]) {
    assert.equal(eventUsesPoints({ ...base, kind }), true, kind);
  }
});
