import assert from "node:assert/strict";
import { test } from "node:test";
import type { ClanLogSection } from "@droptracker/api-types";
import {
  boardSummary,
  categoryLabel,
  completionTone,
  formatClanLogPeriod,
  groupByCategory,
  missingItems,
} from "../lib/clan-log";

function section(
  slug: string,
  category: string,
  items: { id: number; obtained: boolean; attributable?: boolean }[],
): ClanLogSection {
  return {
    slug,
    label: slug,
    category,
    total: items.length,
    obtained: items.filter((i) => i.obtained).length,
    items: items.map((i) => ({
      item_id: i.id,
      name: `item-${i.id}`,
      obtained: i.obtained,
      attributable: i.attributable ?? true,
    })),
  };
}

test("groupByCategory buckets sections and sums their progress", () => {
  const rows = groupByCategory([
    section("cox", "raids", [
      { id: 1, obtained: true },
      { id: 2, obtained: false },
    ]),
    section("tob", "raids", [{ id: 3, obtained: true }]),
    section("kree", "gwd", [{ id: 4, obtained: false }]),
  ]);

  assert.equal(rows.length, 2);
  const raids = rows.find((r) => r.key === "raids")!;
  assert.equal(raids.sections.length, 2);
  assert.equal(raids.total, 3);
  assert.equal(raids.obtained, 2);
  assert.equal(raids.pct, 66.7);
});

test("groupByCategory orders known categories and pushes unknown ones last", () => {
  const rows = groupByCategory([
    section("mystery", "brand_new_content", [{ id: 1, obtained: true }]),
    section("kree", "gwd", [{ id: 2, obtained: true }]),
    section("cox", "raids", [{ id: 3, obtained: true }]),
  ]);
  assert.deepEqual(
    rows.map((r) => r.key),
    ["raids", "gwd", "brand_new_content"],
  );
});

test("groupByCategory reports 0% rather than dividing by zero", () => {
  const rows = groupByCategory([section("empty", "misc", [])]);
  assert.equal(rows[0]?.pct, 0);
});

test("missingItems lists unobtained slots but never pets", () => {
  // Pets are non-attributable: they never arrive as a drop, so their absence
  // is not the kind of fact a hunt list should be built from.
  const missing = missingItems([
    section("kree", "gwd", [
      { id: 1, obtained: true },
      { id: 2, obtained: false },
      { id: 3, obtained: false, attributable: false },
    ]),
  ]);
  assert.deepEqual(
    missing.map((m) => m.item.item_id),
    [2],
  );
});

test("formatClanLogPeriod names all three window shapes", () => {
  assert.equal(formatClanLogPeriod("all"), "All time");
  assert.equal(formatClanLogPeriod("2026"), "2026");
  assert.equal(formatClanLogPeriod("2026-08"), "August 2026");
  assert.equal(formatClanLogPeriod("nonsense"), "nonsense");
});

test("categoryLabel falls back to a readable form for unknown keys", () => {
  assert.equal(categoryLabel("raids"), "Raids");
  assert.equal(categoryLabel("brand_new_content"), "brand new content");
});

test("completionTone escalates with progress", () => {
  assert.notEqual(completionTone(100), completionTone(50));
  assert.notEqual(completionTone(10), completionTone(80));
});

test("boardSummary derives the missing count and never goes negative", () => {
  assert.deepEqual(
    boardSummary({
      schema_version: 1,
      group_id: 1,
      period: "all",
      sections: [],
      summary: { total: 326, obtained: 286, pct: 87.7, per_category: {} },
    }),
    { total: 326, obtained: 286, pct: 87.7, missing: 40 },
  );
});
