/**
 * Staff events overview (/admin/events): which tab an event lands on, and the
 * filters. The draft split matters most: a draft past its start date is not a
 * plain draft, it goes live the moment its blocker is fixed, so staff need it
 * surfaced on its own tab.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { EventSummary } from "@droptracker/api-types";
import {
  adminEventBucket,
  countAdminEvents,
  filterAdminEvents,
  type AdminEventFilters,
} from "@/lib/events";

const NOW = 1_800_000_000;

function ev(over: Partial<EventSummary> & Pick<EventSummary, "id">): EventSummary {
  return {
    group_id: null,
    name: `Event ${over.id}`,
    status: "draft",
    visibility: "public",
    starts_at: null,
    ends_at: null,
    has_bingo: false,
    mode: "standard",
    kind: "standard",
    formation_mode: "admin_assign",
    requires_confirmation: false,
    submission_policy: "all",
    board_size: 5,
    bonus_line_points: 0,
    bonus_blackout_points: 0,
    leadership: { enabled: false, co_leaders: false, selection: "admin" },
    per_group_discord: false,
    allow_live_edits: false,
    effort_visibility: "public",
    tasks_visibility: "public",
    allow_late_signups: false,
    signups_open: true,
    has_schedule: false,
    ...over,
  } as EventSummary;
}

const ALL: AdminEventFilters = { bucket: "all", scope: "all", kind: "all", query: "" };

const EVENTS = [
  ev({ id: 1, status: "active", ends_at: NOW + 500 }),
  ev({ id: 2, status: "active", ends_at: NOW + 100, group_id: 7, group_name: "Realists" }),
  ev({ id: 3, status: "draft", starts_at: NOW + 3600 }),
  ev({ id: 4, status: "draft", starts_at: NOW - 60 }),
  ev({ id: 5, status: "draft" }),
  ev({ id: 6, status: "draft", group_id: 9, kind: "bingo" }),
  ev({ id: 7, status: "past", ends_at: NOW - 10 }),
  ev({ id: 8, status: "past", ends_at: NOW - 5 }),
];

test("buckets follow the event's life", () => {
  assert.equal(adminEventBucket(EVENTS[0]!, NOW), "live");
  assert.equal(adminEventBucket(EVENTS[2]!, NOW), "upcoming");
  assert.equal(adminEventBucket(EVENTS[3]!, NOW), "attention");
  assert.equal(adminEventBucket(EVENTS[4]!, NOW), "draft");
  assert.equal(adminEventBucket(EVENTS[6]!, NOW), "past");
  assert.deepEqual(countAdminEvents(EVENTS, NOW), {
    live: 2,
    upcoming: 1,
    attention: 1,
    draft: 2,
    past: 2,
  });
});

test("each tab is ordered by the date that matters for it", () => {
  const ids = (f: Partial<AdminEventFilters>) =>
    filterAdminEvents(EVENTS, { ...ALL, ...f }, NOW).map((e) => e.id);
  assert.deepEqual(ids({ bucket: "live" }), [2, 1]); // soonest end first
  assert.deepEqual(ids({ bucket: "past" }), [8, 7]); // most recent end first
  assert.deepEqual(ids({ bucket: "draft" }), [6, 5]); // newest first
});

test("scope, format and search filters", () => {
  const ids = (f: Partial<AdminEventFilters>) =>
    filterAdminEvents(EVENTS, { ...ALL, ...f }, NOW).map((e) => e.id).sort();
  assert.deepEqual(ids({ scope: "group" }), [2, 6]);
  assert.equal(ids({ scope: "global" }).length, 6);
  assert.deepEqual(ids({ kind: "bingo" }), [6]);
  assert.deepEqual(ids({ query: "realists" }), [2]); // group name matches
  assert.deepEqual(ids({ query: "4" }), [4]); // exact id matches
});
