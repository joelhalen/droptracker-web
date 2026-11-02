import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { RECAP_SECTIONS, RecapDesignSchema, RecapSchema, defaultRecapDesign } from "@droptracker/api-types";
import {
  bodySections,
  cardAvailability,
  columnSections,
  designsEqual,
  moveSection,
  moveStandout,
  placeSection,
  setColumn,
  setCount,
  setNote,
  toggleHeroStat,
  toggleHidden,
  toggleSection,
  toggleStandout,
} from "../lib/recap-design";
import { RecapCard } from "../components/recap-card";

// Components compile to classic React.createElement calls under tsx, the same
// shim test/sync-settings.test.ts uses.
(globalThis as { React?: typeof React }).React = React;
const createElement = React.createElement;

/**
 * The recap designer (web154a, suggestion #224): the pure edits behind it, and
 * the card drawing a design. The default here must match the backend's
 * (disc tests/unit/test_recap_design.py pins the same values).
 */

test("the default design is the card before designs existed", () => {
  const d = defaultRecapDesign();
  assert.deepEqual(
    d.sections.filter((s) => s.enabled).map((s) => s.key),
    ["gallery", "sources", "members", "standouts", "milestones", "drop"],
  );
  assert.deepEqual(d.standouts, ["pbs", "clog_slots", "cas", "pets", "deaths"]);
  assert.equal(d.counts.members, 5);
  assert.equal(RecapDesignSchema.parse(d).layout, "auto");
  assert.equal(d.sections.length, RECAP_SECTIONS.length);
});

test("panels move within their column and between columns", () => {
  let d = defaultRecapDesign();
  assert.deepEqual(columnSections(d, "side").map((s) => s.key), ["members", "standouts", "milestones", "pets"]);
  d = moveSection(d, "standouts", -1, "column");
  assert.deepEqual(columnSections(d, "side").map((s) => s.key).slice(0, 2), ["standouts", "members"]);
  d = setColumn(d, "members", "main");
  assert.ok(columnSections(d, "main").some((s) => s.key === "members"));
  assert.ok(!columnSections(d, "side").some((s) => s.key === "members"));
  // The drop strip never joins a column.
  assert.ok(!bodySections(d).some((s) => s.key === "drop"));
});

test("moving past the end is a no-op, and drag-and-drop places before a target", () => {
  const d = defaultRecapDesign();
  assert.equal(moveSection(d, "gallery", -1, "column"), d);
  const placed = placeSection(d, "pets", "gallery", "main");
  assert.equal(columnSections(placed, "main")[0]?.key, "pets");
  assert.equal(placed.sections.length, d.sections.length);
});

test("standouts toggle, reorder and cap at ten", () => {
  let d = { ...defaultRecapDesign(), standouts: [] as string[] };
  for (const k of ["loot", "xp", "kills", "ehb", "ehp", "levels", "drops", "pets", "pbs", "cas", "clues"]) d = toggleStandout(d, k);
  assert.equal(d.standouts.length, 10);
  d = moveStandout(d, "xp", -1);
  assert.deepEqual(d.standouts.slice(0, 2), ["xp", "loot"]);
  d = toggleStandout(d, "xp");
  assert.ok(!d.standouts.includes("xp"));
});

test("plaques cap at four, counts clamp, hidden toggles", () => {
  let d = defaultRecapDesign();
  for (const k of ["xp", "kills", "ehb", "levels", "pets"]) d = toggleHeroStat(d, k);
  assert.deepEqual(d.hero_stats, ["xp", "kills", "ehb", "levels"]);
  assert.equal(setCount(d, "members", 99).counts.members, 10);
  assert.equal(setCount(d, "members", 0).counts.members, 3);
  assert.deepEqual(toggleHidden(toggleHidden(d, 5), 5).hidden_players, []);
});

test("typing a message switches the message panel on", () => {
  const d = setNote(defaultRecapDesign(), { body: "Bingo on the 15th" });
  assert.ok(d.sections.find((s) => s.key === "note")?.enabled);
  const off = toggleSection(d, "note", false);
  // Editing an existing message doesn't fight the admin who switched it off.
  assert.ok(!setNote(off, { body: "Bingo on the 16th" }).sections.find((s) => s.key === "note")?.enabled);
});

test("designsEqual is by value", () => {
  assert.ok(designsEqual(defaultRecapDesign(), defaultRecapDesign()));
  assert.ok(!designsEqual(defaultRecapDesign(), { ...defaultRecapDesign(), accent: "frost" }));
});

const RECAP = RecapSchema.parse({
  scope: "group",
  subject: { id: 363, name: "Venture Clan" },
  period: "2026-10",
  schema_version: 1,
  totals: { loot: 22_000_000_000, drops: 300_000, unique_items: 1700, xp: 40_000_000, kills: 5000 },
  top_items: [{ item_id: 1, name: "Twisted bow", loot: 1_500_000_000, receiver: { player_id: 7, name: "AltAccount" }, receivers: 1 }],
  top_npcs: [],
  npc_data_available: false,
  achievements: { pbs: 900, pets: 38 },
  top_members: [
    { player_id: 7, name: "AltAccount", loot: 3_000_000_000 },
    { player_id: 8, name: "Buzzyn", loot: 2_000_000_000 },
  ],
  superlatives: { most_pbs: { player_id: 8, name: "Buzzyn", count: 59 } },
  standouts: {
    categories: [
      { key: "loot", label: "Most loot", unit: "gp", entries: [{ player_id: 7, value: 3e9, name: "AltAccount" }, { player_id: 8, value: 2e9, name: "Buzzyn" }] },
      { key: "pbs", label: "Most personal bests", unit: "count", entries: [{ player_id: 8, value: 59, name: "Buzzyn" }] },
    ],
    skills: [{ metric: "woodcutting", total: 987_496, entries: [{ player_id: 8, value: 987_496, name: "Buzzyn" }] }],
    bosses: [],
  },
  new_pets: [{ player_id: 8, name: "Buzzyn", item_id: 13321, pet: "Rock golem" }],
});

const html = (design: ReturnType<typeof defaultRecapDesign> | null) =>
  renderToStaticMarkup(createElement(RecapCard, { recap: RECAP, design }));

test("no design draws the classic card (superlatives, no new panels)", () => {
  const out = html(null);
  assert.ok(out.includes("Standouts"));
  assert.ok(out.includes("Most personal bests"));
  assert.ok(!out.includes("New pets"));
  assert.ok(!out.includes(">Skills<"));
});

test("a design draws its panels, title, message and accent", () => {
  let d = defaultRecapDesign();
  d = toggleSection(d, "skills", true);
  d = toggleSection(d, "pets", true);
  d = setNote(d, { body: "Well played everyone" });
  d = { ...d, title: "The Venturers", headline: "Our best month", accent: "frost", standouts: ["loot", "pbs"], standouts_depth: 2 };
  const out = html(d);
  assert.ok(out.includes("The Venturers"));
  assert.ok(out.includes("Our best month"));
  assert.ok(out.includes("Well played everyone"));
  assert.ok(out.includes("New pets") && out.includes("Rock golem"));
  assert.ok(out.includes("Woodcutting"));
  assert.ok(out.includes("--gold:#9fdcff"));
  // Depth 2: the runner-up is listed under the leader.
  assert.ok(out.includes("2. Buzzyn"));
});

test("hidden members drop out of rankings and lose their name on items", () => {
  const d = { ...defaultRecapDesign(), hidden_players: [7], standouts: ["loot"] };
  const out = html(d);
  assert.ok(!out.includes("AltAccount"));
  assert.ok(out.includes("Buzzyn"));
  assert.ok(out.includes("Twisted bow"));
});

test("a switched-off panel is gone and the drop strip can be turned off", () => {
  let d = toggleSection(defaultRecapDesign(), "members", false);
  d = toggleSection(d, "gallery", false);
  const out = html(d);
  assert.ok(!out.includes("Top members"));
  assert.ok(!out.includes("Loot gallery"));
});

test("availability says which panels have data", () => {
  const a = cardAvailability(RECAP);
  assert.equal(a.sections.skills, true);
  assert.equal(a.sections.bosses, false);
  assert.equal(a.sections.sources, false);
  assert.ok(a.standouts.has("loot") && !a.standouts.has("xp"));
});
