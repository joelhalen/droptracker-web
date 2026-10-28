/**
 * A group's events on its own page and at /events?group= (suggestion #210):
 * what counts as public, the order they show in, and the link between them.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { EventSummarySchema, type EventSummary } from "@droptracker/api-types";
import {
  groupEventsHref,
  groupFilterParam,
  hasGroupEvents,
  publicGroupEvents,
} from "@/lib/group-events";
import { defaultGroupLayout } from "@/lib/page-layout/catalog";

const NOW = 1_790_000_000;
const DAY = 86_400;

function ev(over: Partial<EventSummary> & { id: number }): EventSummary {
  return EventSummarySchema.parse({
    group_id: 7,
    name: `Event ${over.id}`,
    status: "active",
    starts_at: NOW - DAY,
    ends_at: NOW + DAY,
    ...over,
  });
}

test("private events never reach the group page", () => {
  const out = publicGroupEvents(
    [ev({ id: 1 }), ev({ id: 2, visibility: "private" })],
    [ev({ id: 3, status: "past" }), ev({ id: 4, status: "past", visibility: "private" })],
  );
  assert.deepEqual(out.live.map((e) => e.id), [1]);
  assert.deepEqual(out.past.map((e) => e.id), [3]);
});

test("live events finish soonest first, open-ended last; past events newest first", () => {
  const out = publicGroupEvents(
    [ev({ id: 1, ends_at: null }), ev({ id: 2, ends_at: NOW + 5 * DAY }), ev({ id: 3, ends_at: NOW + DAY })],
    [
      ev({ id: 4, status: "past", ends_at: NOW - 9 * DAY }),
      ev({ id: 5, status: "past", ends_at: NOW - DAY }),
      // No end date: falls back to its start.
      ev({ id: 6, status: "past", ends_at: null, starts_at: NOW - 3 * DAY }),
    ],
  );
  assert.deepEqual(out.live.map((e) => e.id), [3, 2, 1]);
  assert.deepEqual(out.past.map((e) => e.id), [5, 6, 4]);
});

test("a status the list was not asked for is dropped", () => {
  const out = publicGroupEvents([ev({ id: 1, status: "draft" })], [ev({ id: 2, status: "active" })]);
  assert.equal(hasGroupEvents(out), false);
});

test("hasGroupEvents counts live and past", () => {
  assert.equal(hasGroupEvents(null), false);
  assert.equal(hasGroupEvents({ live: [], past: [] }), false);
  assert.equal(hasGroupEvents({ live: [], past: [ev({ id: 1, status: "past" })] }), true);
});

test("the group's event list link prefers the slug", () => {
  assert.equal(groupEventsHref({ id: 42, canonical_slug: "hidden-oasis" }), "/events?group=hidden-oasis");
  assert.equal(groupEventsHref({ id: 42, canonical_slug: null }), "/events?group=42");
  assert.equal(groupEventsHref({ id: 42, canonical_slug: "a b&c" }), "/events?group=a%20b%26c");
});

test("groupFilterParam reads ?group=", () => {
  assert.equal(groupFilterParam(undefined), null);
  assert.equal(groupFilterParam("  "), null);
  assert.equal(groupFilterParam(" 378 "), "378");
  assert.equal(groupFilterParam(["oasis", "x"]), "oasis");
});

test("the standard group page carries the Events block and link", () => {
  const blocks = defaultGroupLayout().blocks as Array<Record<string, unknown>>;
  const events = blocks.find((b) => b.type === "events_list");
  assert.ok(events, "standard layout has an Events block");
  assert.equal(events.id, "std-events");
  const links = blocks.find((b) => b.type === "group_links");
  assert.ok((links?.items as string[]).includes("events"));
});
