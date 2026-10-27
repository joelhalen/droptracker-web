/**
 * any_of_distinct ("any N DIFFERENT items from a list", ticket #446): each
 * listed item counts once, so a second copy of an item the team already has
 * adds nothing. It must read differently from any_of everywhere a player or
 * organiser sees it, because the two modes only differ in that one rule.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { TaskBreakdownGroupSchema, TaskRequirementGroupSchema } from "@droptracker/api-types";
import { groupSummary, taskConfigPaths, taskGoal } from "@/lib/events";

const HILTS = ["Armadyl hilt", "Bandos hilt", "Saradomin hilt", "Zamorak hilt"];

const task = (kind: string, targetValue: number) => ({
  type: "item_collection" as const,
  target: null,
  target_value: targetValue,
  config: JSON.stringify({ kind, items: HILTS }),
});

test("the goal line names the distinct mode and its count", () => {
  assert.equal(taskGoal(task("any_of_distinct", 3)), "any different · 4 items · 3 needed");
});

test("plain any_of keeps its own wording", () => {
  assert.equal(taskGoal(task("any_of", 3)), "any of · 4 items · 3 needed");
});

test("a goal of one needs no count", () => {
  assert.equal(taskGoal(task("any_of_distinct", 1)), "any different · 4 items");
});

test("the breakdown and requirement schemas keep the distinct flag", () => {
  const group = { mode: "any_of", need: 3, obtained: 1, satisfied: false, items: [], distinct: true };
  assert.equal(TaskBreakdownGroupSchema.parse(group).distinct, true);
  assert.equal(
    TaskRequirementGroupSchema.parse({ mode: "any_of", need: 3, label: "Any 3 different", distinct: true })
      .distinct,
    true,
  );
  // Older backends send no flag at all; that must still parse.
  assert.equal(TaskBreakdownGroupSchema.parse({ mode: "any_of", need: 3 }).distinct, undefined);
});

// Suggestion #216: the same rule as a requirement group, so an either-or
// task can be "full Barrows set OR any 10 different Barrows items".
const barrowsPaths = {
  type: "item_collection" as const,
  target: null,
  target_value: 100,
  config: JSON.stringify({
    kind: "any_path",
    paths: [
      { groups: [{ mode: "all_of", items: HILTS.slice(0, 2) }] },
      { groups: [{ mode: "any_of_distinct", need: 3, items: HILTS }] },
    ],
  }),
};

test("a distinct requirement group reads as different items in the goal", () => {
  assert.equal(taskGoal(barrowsPaths), "all 2 items OR any 3 different of 4 items");
});

test("a distinct group survives the config round trip", () => {
  const groups = taskConfigPaths(barrowsPaths)[1]!.groups;
  assert.deepEqual(groups[0], { mode: "any_of_distinct", need: 3, items: HILTS });
});

test("group summaries keep the three modes apart", () => {
  assert.equal(groupSummary({ mode: "all_of", need: 4, items: HILTS }), "all 4");
  assert.equal(groupSummary({ mode: "any_of", need: 2, items: HILTS }), "any 2 of 4");
  assert.equal(groupSummary({ mode: "any_of_distinct", need: 2, items: HILTS }), "any 2 different of 4");
});
