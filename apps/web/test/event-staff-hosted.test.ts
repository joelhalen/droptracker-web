/**
 * Staff-hosted clan-vs-clan (web119a): the players-per-clan wording shown on
 * the invitation page, the wizard review and the clan panel. It must say the
 * same thing as the Discord invite DM (services/event_invites.roster_size_text).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { EventDetailSchema } from "@droptracker/api-types";
import { rosterSizeText } from "@/lib/events";

test("roster size wording", () => {
  assert.equal(rosterSizeText(null, null), null);
  assert.equal(rosterSizeText(undefined, undefined), null);
  assert.equal(rosterSizeText(5, 10), "5 to 10");
  assert.equal(rosterSizeText(4, 4), "exactly 4");
  assert.equal(rosterSizeText(5, null), "at least 5");
  assert.equal(rosterSizeText(null, 8), "up to 8");
});

test("event payloads from before web119a still parse", () => {
  const parsed = EventDetailSchema.parse({
    id: 1,
    group_id: 3,
    name: "Old event",
    status: "draft",
    starts_at: null,
    ends_at: null,
    viewer: { player_ids_on_event: [], signed_up_player_ids: [] },
  });
  assert.equal(parsed.staff_hosted, undefined);
  assert.equal(parsed.viewer?.managed_clan_ids, undefined);
});

test("a staff-hosted payload carries the clan-side fields", () => {
  const parsed = EventDetailSchema.parse({
    id: 9,
    group_id: null,
    name: "Autumn Clash",
    status: "draft",
    mode: "clan_vs_clan",
    starts_at: null,
    ends_at: null,
    staff_hosted: true,
    clan_roster_min: 5,
    clan_roster_max: 10,
    clan_roster_locked_at_start: true,
    viewer: { player_ids_on_event: [], signed_up_player_ids: [], managed_clan_ids: [14] },
  });
  assert.equal(parsed.staff_hosted, true);
  assert.deepEqual(parsed.viewer?.managed_clan_ids, [14]);
});
