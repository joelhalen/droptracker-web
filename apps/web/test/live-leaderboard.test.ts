import assert from "node:assert/strict";
import { test } from "node:test";
import type { LeaderboardEntry } from "@droptracker/api-types";
import {
  applyLeaderboardDelta,
  clearLeaderboardDelta,
  formatLootTotal,
  parseLeaderboardDelta,
} from "../lib/live-leaderboard";

const row = (id: number, value: number): LeaderboardEntry =>
  ({ id, rank: id, name: `p${id}`, loot: { value, value_formatted: formatLootTotal(value) } }) as LeaderboardEntry;

test("only leaderboard_delta frames with an integer id parse", () => {
  assert.deepEqual(parseLeaderboardDelta("leaderboard_delta", { id: 7, delta: 1200 }), {
    id: 7,
    delta: 1200,
  });
  assert.deepEqual(parseLeaderboardDelta("leaderboard_delta", { id: "7" }), { id: 7, delta: 0 });
  assert.equal(parseLeaderboardDelta("drop", { id: 7, delta: 1 }), null);
  assert.equal(parseLeaderboardDelta("leaderboard_delta", { id: "x", delta: 1 }), null);
  assert.equal(parseLeaderboardDelta("leaderboard_delta", undefined), null);
});

test("a delta moves the player's value AND the total shown", () => {
  const rows = [row(1, 2_000_000), row(2, 999_000)];
  const next = applyLeaderboardDelta(rows, { id: 2, delta: 2_000 });
  assert.equal(next[1]!.loot.value, 1_001_000);
  assert.equal(next[1]!.loot.value_formatted, "1.00M");
  assert.equal(next[1]!.delta, 2_000);
  assert.equal(next[0], rows[0]);
});

test("a player who isn't on the page leaves the rows untouched", () => {
  const rows = [row(1, 10)];
  assert.equal(applyLeaderboardDelta(rows, { id: 99, delta: 5 }), rows);
});

test("the transient delta clears", () => {
  const rows = applyLeaderboardDelta([row(1, 10)], { id: 1, delta: 5 });
  assert.equal(clearLeaderboardDelta(rows, 1)[0]!.delta, undefined);
});

test("totals format like the backend's format_number", () => {
  assert.equal(formatLootTotal(1_234_567_890), "1.235B");
  assert.equal(formatLootTotal(12_345_678), "12.35M");
  assert.equal(formatLootTotal(1_500), "1.50K");
  assert.equal(formatLootTotal(999), "999");
});
