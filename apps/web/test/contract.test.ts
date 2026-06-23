import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AnnouncementPageSchema,
  LeaderboardPageSchema,
  PlayerProfileSchema,
} from "@droptracker/api-types";
import openapi from "@droptracker/api-types/openapi" with { type: "json" };
import {
  mockAnnouncements,
  mockPlayerLeaderboard,
  mockPlayerProfile,
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
  assert.doesNotThrow(() => AnnouncementPageSchema.parse(mockAnnouncements()));
});
