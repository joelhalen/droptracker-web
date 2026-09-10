import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EventClanPointsConfigSchema,
  EventClanPointsSchema,
  type EventClanPointsConfig,
} from "@droptracker/api-types";
import {
  isPublicScope,
  ordinal,
  participationSummary,
  paysAnything,
  placeBadge,
  placementSummary,
  statusText,
  trimPlacement,
} from "@/lib/clan-points";

const cfg = (over: Partial<EventClanPointsConfig> = {}): EventClanPointsConfig => ({
  ...EventClanPointsConfigSchema.parse({}),
  ...over,
});

test("ordinals and podium badges", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal),
    ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st", "111th"],
  );
  assert.equal(placeBadge(1), "\u{1F947}");
  assert.equal(placeBadge(4), "4th");
});

test("trimPlacement drops trailing unpaid places and junk", () => {
  assert.deepEqual(trimPlacement([100, 0, 25, 0, 0]), [100, 0, 25]);
  assert.deepEqual(trimPlacement([0, 0]), []);
  assert.deepEqual(trimPlacement([10.7, Number.NaN, -3, 5]), [10, 0, 0, 5]);
});

test("paysAnything needs the toggle AND something to pay", () => {
  assert.equal(paysAnything(cfg({ placement: [10] })), false);
  assert.equal(paysAnything(cfg({ enabled: true })), false);
  assert.equal(paysAnything(cfg({ enabled: true, placement: [0, 5] })), true);
  assert.equal(
    paysAnything(cfg({ enabled: true, participation: { flat: 0, per_hour: 0.5, min_hours: 0, max: 0 } })),
    true,
  );
});

test("placement and participation summaries", () => {
  assert.equal(placementSummary(cfg({ placement: [100, 0, 25] })), "1st +100 · 3rd +25");
  assert.equal(placementSummary(cfg()), null);
  const part = cfg({ participation: { flat: 10, per_hour: 2.5, min_hours: 1, max: 1500 } });
  assert.equal(participationSummary(part), "2.5 per EHE hour +10 for taking part (min 1h, max 1,500)");
  // SOTW/BOTW: no EHE — only the flat amount, and the hour floor is moot.
  assert.equal(participationSummary(part, { ehe: false }), "10 for taking part (max 1,500)");
  assert.equal(participationSummary(cfg({ participation: { flat: 0, per_hour: 3, min_hours: 0, max: 0 } }), { ehe: false }), null);
});

test("status wording follows mode and lifecycle", () => {
  const auto = { status: "pending" as const, config: cfg({ enabled: true }) };
  const review = { status: "pending" as const, config: cfg({ enabled: true, award_mode: "review" }) };
  assert.equal(statusText(auto, "active"), "Awarded automatically when the event ends");
  assert.equal(statusText(review, "active"), "You'll review and award once the event ends");
  assert.equal(statusText(review, "past"), "Ready for your review");
  assert.equal(statusText({ ...auto, status: "deferred" }, "past"), "Waiting to price EHE — retrying automatically");
  assert.equal(statusText({ ...auto, status: "awarded" }, "past"), "Awarded");
});

test("read payload parses, public scopes are offered or paid", () => {
  const data = EventClanPointsSchema.parse({
    event_id: 7,
    status: "past",
    kind: "bingo",
    scopes: [
      {
        group_id: 14,
        group_name: "Pegasus",
        available: true,
        can_manage: false,
        config: { enabled: true, placement: [100, 50] },
        status: "awarded",
        awarded_at: 1_700_000_000,
        awarded: {
          total_points: 250,
          players: 3,
          placement_points: 250,
          participation_points: 0,
          participation_players: 0,
          rows: [
            { player_id: null, player_name: "Hidden player", place: 1, placement: 100, participation: null, hours: null, total: 100 },
          ],
        },
      },
      { group_id: 7, config: {}, status: "pending" },
    ],
  });
  assert.equal(data.scopes[0]!.config.participation.per_hour, 0);
  assert.equal(data.scopes[0]!.awarded!.rows[0]!.player_id, null);
  assert.deepEqual(data.scopes.map(isPublicScope), [true, false]);
});
