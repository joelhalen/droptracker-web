import assert from "node:assert/strict";
import { test } from "node:test";
import { PlayerCollectionLogSchema } from "@droptracker/api-types";
import { slotStatus } from "../lib/collection-log";

// The whole page is a single `PlayerCollectionLogSchema.parse()`, so a field
// the backend does not send yet white-screens a player's profile rather than
// dropping one hover card. `details` therefore has to survive a rollout gap in
// either direction — the frontend deployed first, or rolled back after.
const BASE = {
  player_id: 6445,
  slots: 842,
  slots_total: 1921,
  obtained: 900,
  total: 1921,
  obtained_unique: 842,
  unknown_recorded: 0,
  has_structure: true,
  tabs: [],
  last_synced: "2026-08-27T00:00:00",
  has_synced: true,
};

test("a backend that does not send details yet parses to an empty map", () => {
  const log = PlayerCollectionLogSchema.parse(BASE);
  assert.deepEqual(log.details, {});
});

test("details are keyed by slot id, with both fields nullable", () => {
  const log = PlayerCollectionLogSchema.parse({
    ...BASE,
    details: {
      // The screenshot-carrying case, and the far more common backfilled one
      // where all we ever learned was the date.
      "30753": { ts: 1755959385, image_url: "https://www.droptracker.io/img/x.png" },
      "25627": { ts: 1787780378, image_url: null },
      "7975": { ts: null, image_url: "https://www.droptracker.io/img/y.png" },
    },
  });
  assert.equal(log.details["30753"]?.image_url, "https://www.droptracker.io/img/x.png");
  assert.equal(log.details["25627"]?.image_url, null);
  assert.equal(log.details["7975"]?.ts, null);
});

test("a slot with no submission behind it is simply absent", () => {
  const log = PlayerCollectionLogSchema.parse({ ...BASE, details: {} });
  assert.equal(log.details["12345"], undefined);
});

const slot = (obtained: boolean, quantity = 0) => ({
  item_id: 30753,
  name: "Oathplate chest",
  quantity,
  obtained,
});

test("an obtained slot names its quantity only when there is more than one", () => {
  assert.equal(slotStatus(slot(true, 1)), "Obtained");
  assert.equal(slotStatus(slot(true, 87)), "Obtained · ×87");
  assert.equal(slotStatus(slot(true, 100000)), "Obtained · ×100,000");
});

test("a dimmed slot with a submission behind it blames the sync, not the player", () => {
  // The plugin announces an unlock immediately; `player_clog_items` only
  // catches up when the player next opens the log in game. "Not obtained"
  // sitting directly above "Received today" plus a screenshot reads as a
  // contradiction, and the screenshot is the more convincing of the two.
  assert.equal(
    slotStatus(slot(false), { ts: 1787824894, image_url: null }),
    "Not in the last sync",
  );
});

test("a dimmed slot with nothing behind it is plainly not obtained", () => {
  assert.equal(slotStatus(slot(false)), "Not obtained");
});
