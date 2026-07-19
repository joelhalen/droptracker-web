import assert from "node:assert/strict";
import { test } from "node:test";
import type { LootSweepSet } from "@droptracker/api-types";
import {
  buildMatrixRows,
  buildTeamColumns,
  gatingCounts,
  itemCellTitle,
  maxAwardsOf,
  timeAgo,
} from "../lib/loot-sweep-matrix";

// Minimal set fixtures: one plain boss (with a non-gating pet) and one
// two-group meta-set. Teams are irrelevant to row shaping, so they stay empty.
const kree: LootSweepSet = {
  task_id: 1,
  label: "Kree'arra",
  decay_percent: 20,
  decay_mode: "linear",
  set_bonus_points: 0,
  set_bonus_max: 1,
  groups: [
    {
      npcs: ["Kree'arra"],
      bonus_points: 40,
      bonus_max: 1,
      items: [
        { item_name: "Armadyl helmet", points: 9 },
        { item_name: "Pet kree'arra", points: 60, counts_for_group: false, source: "pet" },
        { item_name: "Armadyl hilt", points: 13 },
      ],
    },
  ],
  teams: [],
};

const barrows: LootSweepSet = {
  task_id: 2,
  label: "Barrows",
  decay_percent: 20,
  decay_mode: "linear",
  set_bonus_points: 40,
  set_bonus_max: 1,
  groups: [
    {
      label: "Ahrim",
      npcs: ["Ahrim the Blighted"],
      bonus_points: 4,
      bonus_max: 1,
      items: [{ item_name: "Ahrim's hood", points: 2 }],
    },
    {
      label: "Dharok",
      npcs: ["Dharok the Wretched"],
      bonus_points: 4,
      bonus_max: 1,
      items: [{ item_name: "Dharok's helm", points: 2 }],
    },
  ],
  teams: [],
};

test("buildMatrixRows: single-group sets skip group rows; bonus items sort last", () => {
  const rows = buildMatrixRows([kree]);
  assert.deepEqual(
    rows.map((r) => r.kind),
    ["set", "item", "item", "item"],
  );
  // Config order was helmet, pet, hilt — the non-gating pet moves to the end
  // but keeps its ORIGINAL itemIdx (1), which is what indexes team progress.
  const items = rows.filter((r) => r.kind === "item");
  assert.deepEqual(
    items.map((r) => r.item.item_name),
    ["Armadyl helmet", "Armadyl hilt", "Pet kree'arra"],
  );
  assert.deepEqual(
    items.map((r) => r.itemIdx),
    [0, 2, 1],
  );
  assert.deepEqual(
    items.map((r) => r.gates),
    [true, true, false],
  );
});

test("buildMatrixRows: meta-sets interleave group header rows", () => {
  const rows = buildMatrixRows([barrows]);
  assert.deepEqual(
    rows.map((r) => r.kind),
    ["set", "group", "item", "group", "item"],
  );
  const setRow = rows[0]!;
  assert.ok(setRow.kind === "set" && setRow.multiGroup && setRow.gatingGroups === 2);
});

test("buildTeamColumns: ranks by score, pins the viewer with rank intact", () => {
  const teams = [
    { id: 10, name: "Alpha", color: null, score: 100 },
    { id: 11, name: "Bravo", color: "#123456", score: 300 },
    { id: 12, name: "Charlie", color: null, score: 200 },
  ];
  const colors = new Map([
    [10, "#a"],
    [11, "#123456"],
    [12, "#c"],
  ]);
  const cols = buildTeamColumns(teams, 10, colors);
  assert.deepEqual(
    cols.map((c) => [c.id, c.rank, c.isViewer]),
    [
      [10, 3, true],
      [11, 1, false],
      [12, 2, false],
    ],
  );
  // No viewer → pure rank order.
  const anon = buildTeamColumns(teams, null, colors);
  assert.deepEqual(
    anon.map((c) => c.id),
    [11, 12, 10],
  );
});

test("gatingCounts counts only gating items received at least once", () => {
  const group = kree.groups[0]!;
  const teamGroup = {
    completions: 0,
    awarded: 0,
    bonus_total: 0,
    item_total: 0,
    // helmet ×2, pet ×1 (non-gating), hilt ×0
    items: [
      { count: 2, scored: 2, points: 16 },
      { count: 1, scored: 1, points: 60 },
      { count: 0, scored: 0, points: 0 },
    ],
  };
  assert.deepEqual(gatingCounts(group, teamGroup), { got: 1, of: 2 });
  assert.deepEqual(gatingCounts(group, undefined), { got: 0, of: 2 });
});

test("maxAwardsOf: explicit cap wins, else 5 tiers × awards_per_tier", () => {
  assert.equal(maxAwardsOf({ item_name: "x", points: 1 }), 5);
  assert.equal(maxAwardsOf({ item_name: "x", points: 1, awards_per_tier: 3 }), 15);
  assert.equal(maxAwardsOf({ item_name: "x", points: 1, awards_per_tier: 3, max_awards: 7 }), 7);
});

test("timeAgo: compact buckets, hours run to 48 before days", () => {
  const now = 1_800_000_000_000;
  const at = (secsAgo: number) => Math.floor(now / 1000) - secsAgo;
  assert.equal(timeAgo(at(30), now), "just now");
  assert.equal(timeAgo(at(5 * 60), now), "5m ago");
  assert.equal(timeAgo(at(40 * 3600), now), "40h ago");
  assert.equal(timeAgo(at(3 * 86400), now), "3d ago");
  assert.equal(timeAgo(at(30 * 86400), now), "4w ago");
  assert.equal(timeAgo(null, now), "");
});

test("itemCellTitle: shows decayed next-receipt value, then the cap", () => {
  const item = { item_name: "Armadyl hilt", points: 10 };
  const untouched = itemCellTitle({
    teamName: "Alpha",
    item,
    prog: undefined,
    decayPercent: 20,
    decayMode: "linear",
  });
  assert.match(untouched, /worth 10 each, up to 5/);
  const partial = itemCellTitle({
    teamName: "Alpha",
    item,
    prog: { count: 1, scored: 1, points: 10 },
    decayPercent: 20,
    decayMode: "linear",
  });
  // Second receipt of a 10-pointer at 20% linear decay = 8.
  assert.match(partial, /next worth 8/);
  const capped = itemCellTitle({
    teamName: "Alpha",
    item,
    prog: { count: 6, scored: 5, points: 30 },
    decayPercent: 20,
    decayMode: "linear",
  });
  assert.match(capped, /capped \(5\/5 scored\)/);
});
