/**
 * slayer_target criteria helpers. The task stores master IDS (allow-list or
 * deny-list); these decide how a stored config reads back into the form and
 * how it is summarised — including the one case that must not be mistaken
 * for a custom choice: the server's own default exclusion.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SLAYER_RESET_MASTER_IDS,
  isDefaultSlayerExclusion,
  slayerRequirement,
  slayerRequirementSummary,
} from "@/lib/events";

const NAMES: Record<number, string> = { 1: "Turael/Aya", 5: "Duradel/Kuradal", 8: "Konar", 9: "Spria" };

test("no config at all reads as the server default: reset masters excluded", () => {
  const req = slayerRequirement({ config: null });
  assert.equal(req.masters, null);
  assert.deepEqual(req.excludeMasters, [...SLAYER_RESET_MASTER_IDS]);
  assert.deepEqual(req.tasks, []);
  assert.equal(req.bossOnly, false);
  assert.ok(isDefaultSlayerExclusion(req.excludeMasters));
});

test("an explicit empty deny-list means every master, and is not the default", () => {
  const req = slayerRequirement({ config: JSON.stringify({ exclude_masters: [] }) });
  assert.deepEqual(req.excludeMasters, []);
  assert.equal(isDefaultSlayerExclusion(req.excludeMasters), false);
  assert.equal(slayerRequirementSummary(req, 3, NAMES), "3 slayer tasks — any master");
});

test("allow-list wins and ids are coerced/deduped", () => {
  const req = slayerRequirement({
    config: JSON.stringify({ masters: ["5", 8, 8, "junk", 0], exclude_masters: [1] }),
  });
  assert.deepEqual(req.masters, [5, 8]);
  assert.deepEqual(req.excludeMasters, []);
  assert.equal(
    slayerRequirementSummary(req, 10, NAMES),
    "10 slayer tasks — from Duradel/Kuradal / Konar",
  );
});

test("default exclusion is recognised regardless of order", () => {
  assert.ok(isDefaultSlayerExclusion([9, 1]));
  assert.equal(isDefaultSlayerExclusion([1]), false);
  assert.equal(isDefaultSlayerExclusion([1, 9, 7]), false);
});

test("summary names the reset masters even before the catalog has loaded", () => {
  const req = slayerRequirement({ config: JSON.stringify({ exclude_masters: [1, 9] }) });
  assert.equal(
    slayerRequirementSummary(req, 1),
    "1 slayer task — any master except Turael/Aya, Spria",
  );
  // An id nobody knows is shown, not dropped.
  const custom = slayerRequirement({ config: JSON.stringify({ exclude_masters: [42] }) });
  assert.equal(slayerRequirementSummary(custom, 2), "2 slayer tasks — any master except #42");
});

test("pinned assignments and boss-only ride along in the summary", () => {
  const req = slayerRequirement({
    config: JSON.stringify({ tasks: ["Abyssal demons", "", 7, "Cave kraken"], boss_only: true }),
  });
  assert.deepEqual(req.tasks, ["Abyssal demons", "Cave kraken"]);
  assert.equal(req.bossOnly, true);
  assert.equal(
    slayerRequirementSummary(req, 5, NAMES),
    "5 slayer tasks — any master except Turael/Aya, Spria — Abyssal demons / Cave kraken — boss tasks only",
  );
  const many = slayerRequirement({
    config: JSON.stringify({ exclude_masters: [], tasks: ["A", "B", "C", "D"] }),
  });
  assert.equal(slayerRequirementSummary(many, 5), "5 slayer tasks — any master — 4 assignments");
});
