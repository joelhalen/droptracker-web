import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NotificationBlacklistEntrySchema,
  NotificationBlacklistSchema,
} from "@droptracker/api-types";

/**
 * The blacklist crosses the BFF boundary, so its Zod schema is the contract:
 * everything the backend can send has to parse, and anything it cannot send has
 * to fail loudly rather than reach the editor as a half-typed row.
 */

test("an entry from the picker parses with its icon id", () => {
  const entry = NotificationBlacklistEntrySchema.parse({
    id: 7,
    entry_type: "item",
    name: "Twisted bow",
    match_key: "twisted-bow",
    game_id: 20997,
    added_at: "2026-08-25T12:00:00",
  });
  assert.equal(entry.game_id, 20997);
  assert.equal(entry.match_key, "twisted-bow");
});

test("a hand-typed entry parses with no game id and no icon", () => {
  // Names the item/NPC catalog has not caught up with are valid entries; they
  // simply render without an icon.
  const entry = NotificationBlacklistEntrySchema.parse({
    id: 8,
    entry_type: "npc",
    name: "Some New Boss",
    match_key: "some-new-boss",
    game_id: null,
    added_at: null,
  });
  assert.equal(entry.game_id, null);
  assert.equal(entry.added_at, null);
});

test("optional id/timestamp fields default rather than failing the parse", () => {
  const entry = NotificationBlacklistEntrySchema.parse({
    id: 9,
    entry_type: "item",
    name: "Bones",
    match_key: "bones",
  });
  assert.equal(entry.game_id, null);
  assert.equal(entry.added_at, null);
});

test("an unknown entry type is rejected", () => {
  // Only 'item' and 'npc' exist. A third kind reaching the editor would render
  // a chip whose remove button targets a list the backend does not have.
  assert.throws(() =>
    NotificationBlacklistEntrySchema.parse({
      id: 10,
      entry_type: "player",
      name: "Zezima",
      match_key: "zezima",
    }),
  );
});

test("the list payload carries the server-enforced cap", () => {
  const payload = NotificationBlacklistSchema.parse({
    entries: [
      { id: 1, entry_type: "item", name: "Bones", match_key: "bones", game_id: 526 },
      { id: 2, entry_type: "npc", name: "Barrows", match_key: "barrows", game_id: null },
    ],
    limit: 250,
  });
  assert.equal(payload.limit, 250);
  assert.deepEqual(
    payload.entries.map((e) => e.entry_type),
    ["item", "npc"],
  );
});

test("a list without its cap is rejected", () => {
  // The editor stops offering "add" at `limit`; a missing one would silently
  // read as 0 and lock the card.
  assert.throws(() => NotificationBlacklistSchema.parse({ entries: [] }));
});
