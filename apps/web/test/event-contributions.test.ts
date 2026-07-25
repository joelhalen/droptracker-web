/**
 * Contribution shaping for the team roster: how one credited action reads, and
 * which task types the counter folds. `METRIC_TASK_TYPES` must stay in step
 * with the backend's `METRIC_TASK_TYPES` in `web_api/event_players.py` — the
 * server does the counting, this set only decides how it is captioned.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { EventMemberLastContribution } from "@droptracker/api-types";
import {
  METRIC_TASK_TYPES,
  contributionSummary,
  taskQuantityLabel,
  taskTypeLabel,
} from "@/lib/events";

function contribution(
  over: Partial<EventMemberLastContribution> = {},
): EventMemberLastContribution {
  return {
    task_id: 1,
    task_label: "A task",
    task_type: "item_collection",
    quantity: 1,
    source_type: "drop",
    matched_target: null,
    created_at: 1_700_000_000,
    ...over,
  };
}

test("an item contribution names the item, with a count only when stacked", () => {
  assert.equal(
    contributionSummary(contribution({ matched_target: "Twisted bow" })),
    "Twisted bow",
  );
  assert.equal(
    contributionSummary(contribution({ matched_target: "Bones", quantity: 24 })),
    "Bones ×24",
  );
});

test("metric contributions read in their own units", () => {
  assert.equal(
    contributionSummary(contribution({ task_type: "kc_target", quantity: 14 })),
    "14 kills",
  );
  assert.equal(
    contributionSummary(contribution({ task_type: "kc_target", quantity: 1 })),
    "1 kill",
  );
  assert.equal(
    contributionSummary(contribution({ task_type: "xp_target", quantity: 1_200_000 })),
    "1.20M xp",
  );
  assert.equal(
    contributionSummary(contribution({ task_type: "loot_value", quantity: 4_250_000 })),
    "4.25M gp",
  );
});

test("achievement-shaped tasks describe themselves", () => {
  assert.equal(contributionSummary(contribution({ task_type: "pb_target" })), "personal best");
  assert.equal(
    contributionSummary(contribution({ task_type: "skill_target" })),
    "level reached",
  );
});

test("manual and bonus awards are labelled by their source", () => {
  assert.equal(
    contributionSummary(contribution({ task_type: "custom", source_type: "manual" })),
    "admin award",
  );
  assert.equal(
    contributionSummary(contribution({ task_type: "custom", source_type: "bonus" })),
    "bonus",
  );
});

test("an unrecognised task type still says something useful", () => {
  assert.equal(
    contributionSummary(contribution({ task_type: "brand_new", source_type: "drop" })),
    "credited",
  );
  assert.equal(
    contributionSummary(
      contribution({ task_type: "brand_new", source_type: "drop", quantity: 5 }),
    ),
    "×5",
  );
});

test("metric task types match the backend's folding set", () => {
  // Rising-metric tasks fold to one contribution; acquisitions do not.
  for (const t of ["xp_target", "kc_target", "skill_target", "loot_value", "ehp_target", "ehb_target"]) {
    assert.ok(METRIC_TASK_TYPES.has(t), `${t} should fold`);
  }
  for (const t of ["item_collection", "pet_collection", "pb_target", "loot_sweep", "custom"]) {
    assert.ok(!METRIC_TASK_TYPES.has(t), `${t} should count per acquisition`);
  }
});

test("per-task quantities carry their unit", () => {
  assert.equal(taskQuantityLabel("kc_target", 14), "14 kills");
  assert.equal(taskQuantityLabel("kc_target", 1), "1 kill");
  assert.equal(taskQuantityLabel("xp_target", 4_250_000), "4.25M xp");
  assert.equal(taskQuantityLabel("loot_value", 1_000_000_000), "1.00B gp");
  assert.equal(taskQuantityLabel("item_collection", 24), "×24");
  assert.equal(taskQuantityLabel(null, 3), "×3");
});

test("quantities with no meaning render as nothing", () => {
  // A personal best or a level is reached, not accumulated — "×1" would lie.
  assert.equal(taskQuantityLabel("pb_target", 1), "");
  assert.equal(taskQuantityLabel("skill_target", 1), "");
  assert.equal(taskQuantityLabel("ehp_target", 1), "");
  assert.equal(taskQuantityLabel("ehb_target", 1), "");
});

test("task type labels fall back to the raw value", () => {
  assert.equal(taskTypeLabel("kc_target"), "Kill count");
  assert.equal(taskTypeLabel("brand_new_type"), "brand_new_type");
  assert.equal(taskTypeLabel(null), "");
  assert.equal(taskTypeLabel(undefined), "");
});
