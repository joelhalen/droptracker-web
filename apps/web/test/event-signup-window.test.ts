import assert from "node:assert/strict";
import { test } from "node:test";
import { EventSummarySchema } from "@droptracker/api-types";

// web70a: sign-ups close when the event begins unless it allows late ones.
// The backend decides — `signups_open` is what the join panel and the admin
// "post sign-up to Discord" button read, so the contract has to survive
// payloads that predate the fields (a cached page mid-deploy).

test("EventSummarySchema defaults the sign-up window open on pre-web70a payloads", () => {
  const legacy = EventSummarySchema.parse({
    id: 1,
    group_id: null,
    name: "Old Event",
    status: "active",
    starts_at: null,
    ends_at: null,
  });
  // Open by default: an old payload must never hide the join form.
  assert.equal(legacy.signups_open, true);
  assert.equal(legacy.allow_late_signups, false);
  assert.equal(legacy.signups_close_at ?? null, null);
});

test("EventSummarySchema carries a closed window through", () => {
  const closed = EventSummarySchema.parse({
    id: 2,
    group_id: 42,
    name: "Underway",
    status: "active",
    starts_at: 1700000000,
    ends_at: 1700600000,
    allow_late_signups: false,
    signups_open: false,
    signups_close_at: 1700000000,
  });
  assert.equal(closed.signups_open, false);
  assert.equal(closed.signups_close_at, 1700000000);
});

test("late sign-ups keep a running event open to its end", () => {
  const open = EventSummarySchema.parse({
    id: 3,
    group_id: 42,
    name: "Latecomers welcome",
    status: "active",
    starts_at: 1700000000,
    ends_at: 1700600000,
    allow_late_signups: true,
    signups_open: true,
    signups_close_at: 1700600000,
  });
  assert.equal(open.allow_late_signups, true);
  assert.equal(open.signups_close_at, open.ends_at);
});
