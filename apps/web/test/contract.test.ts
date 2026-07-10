import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AdminLookupResponseSchema,
  AdminSubscriptionsOverviewSchema,
  AnnouncementPageSchema,
  AdminTicketPageSchema,
  GroupSubscriptionSchema,
  GroupSubscriptionSummarySchema,
  EventDetailSchema,
  EventTeamDetailSchema,
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
  SupportersSchema,
  allConfigKeys,
  getConfigField,
} from "@droptracker/api-types";
import openapi from "@droptracker/api-types/openapi" with { type: "json" };
import {
  mockAnnouncements,
  mockEvent,
  mockEventTeam,
  mockEvents,
  mockAdminSubscriptionsOverview,
  mockAdminTickets,
  mockGroupSubscription,
  mockGroupSubscriptionSummary,
  mockLookup,
  mockLootboard,
  mockMyTickets,
  mockTicket,
  mockMe,
  mockPlayerLeaderboard,
  mockPlayerLoot,
  mockPlayerProfile,
  mockServices,
  mockSupporters,
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
  assert.doesNotThrow(() => EventTeamDetailSchema.parse(mockEventTeam(1, 21)));
  assert.doesNotThrow(() => GroupSubscriptionSchema.parse(mockGroupSubscription(101)));
  assert.doesNotThrow(() => GroupSubscriptionSummarySchema.parse(mockGroupSubscriptionSummary(101)));
  assert.doesNotThrow(() => AdminSubscriptionsOverviewSchema.parse(mockAdminSubscriptionsOverview()));
  assert.doesNotThrow(() => TicketPageSchema.parse(mockMyTickets()));
  assert.doesNotThrow(() => TicketDetailSchema.parse(mockTicket(2)));
  assert.doesNotThrow(() => AdminTicketPageSchema.parse(mockAdminTickets()));
  assert.doesNotThrow(() => SupportersSchema.parse(mockSupporters()));
});

// The backend serializes an empty event description as JSON null (not omitted).
// A plain `.optional()` on the Zod schema rejected null, so a single
// description-less event made the whole /events list parse throw and blanked
// the group-admin events page. Lock in that null (and undefined) are accepted.
test("EventSummary accepts null/absent description", () => {
  const base = {
    id: 1,
    group_id: 267,
    name: "Koeppy Test",
    status: "draft" as const,
    starts_at: null,
    ends_at: null,
    has_bingo: false,
    formation_mode: "admin_assign" as const,
    requires_confirmation: false,
    submission_policy: "all" as const,
    board_size: 5,
    bonus_line_points: 0,
    bonus_blackout_points: 0,
  };
  assert.doesNotThrow(() => EventSummarySchema.parse({ ...base, description: null }));
  assert.doesNotThrow(() => EventSummarySchema.parse(base));
  assert.doesNotThrow(() => EventSummarySchema.parse({ ...base, description: "hi" }));
  // A mixed list (one with, one without a description) must fully parse.
  assert.doesNotThrow(() =>
    EventSummarySchema.array().parse([
      { ...base, id: 2, name: "Bingo Test!", status: "active", description: "Let's go" },
      { ...base, id: 3, description: null },
    ]),
  );
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
