import assert from "node:assert/strict";
import { test } from "node:test";
import { WomSyncResultSchema } from "@droptracker/api-types";

/**
 * The Sync-from-WOM button is rate-limited to one run per group per hour. A
 * refused request and a sync that ran and changed nothing both report
 * `added: 0, removed: 0`, so `on_cooldown` is the only thing separating "your
 * roster is already correct" from "we never asked WOM". A group admin who had
 * just enabled auto-provisioning read the first as the second and re-clicked
 * for an hour, which is what these assertions exist to prevent regressing.
 */

test("a rate-limited sync is distinguishable from a no-op sync", () => {
  const refused = WomSyncResultSchema.parse({
    added: 0,
    removed: 0,
    total: 93,
    synced_ts: 1_756_750_000,
    on_cooldown: true,
    cooldown_remaining_seconds: 2031,
    skipped_removals: false,
  });
  const ranAndChangedNothing = WomSyncResultSchema.parse({
    added: 0,
    removed: 0,
    total: 93,
    synced_ts: 1_756_750_000,
    on_cooldown: false,
    cooldown_remaining_seconds: 0,
    skipped_removals: false,
  });

  assert.equal(refused.on_cooldown, true);
  assert.equal(ranAndChangedNothing.on_cooldown, false);
  // The refusal must not report the group as empty — that read as data loss.
  assert.equal(refused.total, 93);
});

test("a response from an API build without the cooldown fields still parses", () => {
  // The web and backend repos deploy separately, so the button has to keep
  // working against an API that predates these fields rather than throwing a
  // Zod error at the BFF boundary.
  const legacy = WomSyncResultSchema.parse({
    added: 3,
    removed: 1,
    total: 427,
    synced_ts: 1_756_750_000,
  });
  assert.equal(legacy.on_cooldown, false);
  assert.equal(legacy.cooldown_remaining_seconds, 0);
  assert.equal(legacy.skipped_removals, false);
});

test("added and removed are counts, never the backend's name lists", () => {
  assert.throws(() =>
    WomSyncResultSchema.parse({
      added: ["Zezima", "Woox"],
      removed: [],
      total: 427,
      synced_ts: 1_756_750_000,
    }),
  );
});
