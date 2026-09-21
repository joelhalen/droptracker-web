/**
 * any_of_distinct ("any N DIFFERENT items from a list", ticket #446): each
 * listed item counts once, so a second copy of an item the team already has
 * adds nothing. It must read differently from any_of everywhere a player or
 * organiser sees it, because the two modes only differ in that one rule.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { TaskBreakdownGroupSchema, TaskRequirementGroupSchema } from "@droptracker/api-types";
import { taskGoal } from "@/lib/events";

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
