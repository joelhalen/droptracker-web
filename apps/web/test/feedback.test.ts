import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AdminFeedbackOverviewSchema,
  FeedbackAnswerSchema,
  FeedbackPromptSchema,
  type FeedbackGroup,
} from "@droptracker/api-types";
import {
  RATINGS,
  attributionOptions,
  blankDraft,
  defaultAttribution,
  initialGroupId,
  ratingBand,
  toAnswer,
} from "@/lib/feedback";

const group = (id: number, role: "owner" | "admin" = "owner"): FeedbackGroup => ({
  group_id: id,
  name: `Clan ${id}`,
  role,
  tier: "free",
  tier_name: "Free",
  member_count: 10,
  since: null,
});

test("the scale runs 1 to 10", () => {
  assert.deepEqual(RATINGS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("the card starts on the clan whose page you're on, if you lead it", () => {
  const groups = [group(4), group(9, "admin")];
  assert.equal(initialGroupId(groups, "/groups/9/settings"), 9);
  assert.equal(initialGroupId(groups, "/groups/9"), 9);
  assert.equal(initialGroupId(groups, "/groups/77/settings"), 4);
  assert.equal(initialGroupId(groups, "/groups/94"), 4);
  assert.equal(initialGroupId(groups, "/dashboard"), 4);
  assert.equal(initialGroupId([], "/groups/9"), null);
  // group 0 is a real id
  assert.equal(initialGroupId([group(0)], "/groups/0/settings"), 0);
});

test("attribution defaults to the clan name, or anonymous without a clan", () => {
  assert.equal(defaultAttribution(3), "clan");
  assert.equal(defaultAttribution(0), "clan");
  assert.equal(defaultAttribution(null), "anon");
  assert.deepEqual(attributionOptions(true).map((o) => o.value), ["clan", "full", "anon"]);
  assert.deepEqual(attributionOptions(false).map((o) => o.value), ["full", "anon"]);
});

test("no score means nothing to send", () => {
  assert.equal(toAnswer(blankDraft(3), 1), null);
});

test("a draft becomes a valid answer", () => {
  const answer = toAnswer(
    { ...blankDraft(3), rating: 8, liked: "  Loot boards ", quoteConsent: true },
    12,
  );
  assert.ok(answer);
  assert.equal(answer.liked_text, "Loot boards");
  assert.equal(answer.attribution, "clan");
  assert.equal(answer.request_id, 12);
  assert.ok(FeedbackAnswerSchema.safeParse(answer).success);
});

test("answers outside 1-10 or over 500 characters are refused", () => {
  const base = toAnswer({ ...blankDraft(null), rating: 5 }, null)!;
  assert.equal(FeedbackAnswerSchema.safeParse({ ...base, rating: 11 }).success, false);
  assert.equal(FeedbackAnswerSchema.safeParse({ ...base, rating: 0 }).success, false);
  assert.equal(FeedbackAnswerSchema.safeParse({ ...base, liked_text: "x".repeat(501) }).success, false);
});

test("rating bands match the Discord colours", () => {
  assert.equal(ratingBand(4), "low");
  assert.equal(ratingBand(5), "mid");
  assert.equal(ratingBand(7), "mid");
  assert.equal(ratingBand(8), "high");
});

test("backend payloads parse", () => {
  assert.ok(FeedbackPromptSchema.parse({ prompt: null, groups: [] }));
  assert.ok(FeedbackPromptSchema.parse({ prompt: { request_id: 2 }, groups: [group(1)] }));
  const overview = AdminFeedbackOverviewSchema.parse({
    requests: [
      {
        id: 1,
        title: "Test",
        audience: [{ type: "users", user_ids: [0, 2] }],
        audience_summary: "2 people",
        status: "live",
        audience_estimate: 2,
        sent_at: 1,
        ended_at: null,
        created_at: 1,
        seen_count: 0,
        answered_count: 0,
        snoozed_count: 0,
        declined_count: 0,
      },
    ],
    responses: [],
    labels: { users: {}, groups: {}, tiers: {} },
  });
  assert.equal(overview.requests[0]!.average_rating, null);
});
