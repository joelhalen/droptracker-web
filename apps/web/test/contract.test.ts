import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AdminLookupResponseSchema,
  AnnouncementPageSchema,
  AdminTicketPageSchema,
  EventDetailSchema,
  EventSummarySchema,
  TicketDetailSchema,
  TicketPageSchema,
  GroupConfigPatchSchema,
  LeaderboardPageSchema,
  LootboardSchema,
  MeSchema,
  PlayerLootTrackerSchema,
  PlayerProfileSchema,
  ServiceStatusSchema,
  allConfigKeys,
  getConfigField,
} from "@droptracker/api-types";
import openapi from "@droptracker/api-types/openapi" with { type: "json" };
import {
  mockAnnouncements,
  mockEvent,
  mockEvents,
  mockAdminTickets,
  mockLookup,
  mockLootboard,
  mockMyTickets,
  mockTicket,
  mockMe,
  mockPlayerLeaderboard,
  mockPlayerLoot,
  mockPlayerProfile,
  mockServices,
} from "../lib/mock-data";

// Contract test: every path the BFF client calls must exist in the published
// OpenAPI spec (FRONTEND_PLAN.md §20.4 "contract test against OpenAPI").
test("OpenAPI spec declares the public-read surface the BFF consumes", () => {
  const paths = Object.keys((openapi as { paths: Record<string, unknown> }).paths);
  for (const expected of [
    "/leaderboards/players",
    "/leaderboards/groups",
    "/players/{playerId}",
    "/groups/{groupId}",
    "/announcements",
    "/me",
  ]) {
    assert.ok(paths.includes(expected), `OpenAPI missing path ${expected}`);
  }
});

// The mock payloads must satisfy the shared Zod schemas, guaranteeing the
// fallback data matches the contract the real API will return.
test("mock payloads validate against shared schemas", () => {
  assert.doesNotThrow(() => LeaderboardPageSchema.parse(mockPlayerLeaderboard(1, 10)));
  assert.doesNotThrow(() => PlayerProfileSchema.parse(mockPlayerProfile(42)));
  assert.doesNotThrow(() => PlayerLootTrackerSchema.parse(mockPlayerLoot(42)));
  assert.doesNotThrow(() => AnnouncementPageSchema.parse(mockAnnouncements()));
  assert.doesNotThrow(() => MeSchema.parse(mockMe()));
  assert.doesNotThrow(() => ServiceStatusSchema.array().parse(mockServices()));
  assert.doesNotThrow(() => AdminLookupResponseSchema.parse(mockLookup("zez")));
  assert.doesNotThrow(() => LootboardSchema.parse(mockLootboard(42, "all")));
  assert.doesNotThrow(() => EventSummarySchema.array().parse(mockEvents()));
  assert.doesNotThrow(() => EventDetailSchema.parse(mockEvent(1)));
  assert.doesNotThrow(() => TicketPageSchema.parse(mockMyTickets()));
  assert.doesNotThrow(() => TicketDetailSchema.parse(mockTicket(2)));
  assert.doesNotThrow(() => AdminTicketPageSchema.parse(mockAdminTickets()));
});

// Every config key (incl. seasonal mirrors) must resolve to a field — guards the
// `seasonal_boards` prefix collision (a base key that starts with `seasonal_`).
test("group-config registry resolves all keys", () => {
  for (const key of allConfigKeys()) {
    assert.ok(getConfigField(key), `unresolved config field for key ${key}`);
  }
  assert.equal(getConfigField("seasonal_boards")?.key, "seasonal_boards");
  // An empty patch is always valid (PATCH sends only changed keys).
  assert.doesNotThrow(() => GroupConfigPatchSchema.parse({}));
});
