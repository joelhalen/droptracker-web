import assert from "node:assert/strict";
import { test } from "node:test";
import { EventSummarySchema, type EventSummary } from "@droptracker/api-types";
import { mockEvents, mockEventsMine } from "../lib/mock-data";
import { pickYourEventButtons } from "../lib/events";

test("mockEventsMine parses as EventSummary[] and is a subset of mockEvents", () => {
  const mine = EventSummarySchema.array().parse(mockEventsMine());
  assert.ok(mine.length >= 3, "expected live + upcoming + past in the mine mock");
  const allIds = new Set(mockEvents().map((e) => e.id));
  for (const e of mine) assert.ok(allIds.has(e.id), `mine event ${e.id} missing from mockEvents`);
});

test("mockEventsMine covers every state the button needs", () => {
  const statuses = new Set(mockEventsMine().map((e) => e.status));
  assert.ok(statuses.has("active"));
  assert.ok(statuses.has("draft"));
  assert.ok(statuses.has("past"));
});

test("mockEventsMine honors the status filter", () => {
  assert.ok(mockEventsMine("draft").every((e) => e.status === "draft"));
  assert.ok(mockEventsMine("draft").length >= 1);
});

function ev(over: Partial<EventSummary> & { id: number }): EventSummary {
  return EventSummarySchema.parse({
    id: over.id,
    group_id: 101,
    name: `Event ${over.id}`,
    status: "active",
    starts_at: 1_000,
    ends_at: 2_000,
    ...over,
  });
}

test("pickYourEventButtons: live first (soonest end), then upcoming (soonest start)", () => {
  const picked = pickYourEventButtons([
    ev({ id: 1, status: "draft", starts_at: 5_000 }),
    ev({ id: 2, status: "active", ends_at: 9_000 }),
    ev({ id: 3, status: "active", ends_at: 3_000 }),
  ]);
  assert.deepEqual(
    picked.map((e) => e.id),
    [3, 2, 1],
  );
});

test("pickYourEventButtons: past excluded, cap at 3", () => {
  const picked = pickYourEventButtons([
    ev({ id: 1, status: "past" }),
    ev({ id: 2, status: "active", ends_at: 1_000 }),
    ev({ id: 3, status: "active", ends_at: 2_000 }),
    ev({ id: 4, status: "active", ends_at: 3_000 }),
    ev({ id: 5, status: "draft", starts_at: 4_000 }),
  ]);
  assert.deepEqual(
    picked.map((e) => e.id),
    [2, 3, 4],
  );
});

test("pickYourEventButtons: null timestamps sort last within their bucket", () => {
  const picked = pickYourEventButtons([
    ev({ id: 1, status: "active", ends_at: null }),
    ev({ id: 2, status: "active", ends_at: 7_000 }),
    ev({ id: 3, status: "draft", starts_at: null }),
    ev({ id: 4, status: "draft", starts_at: 6_000 }),
  ]);
  assert.deepEqual(
    picked.map((e) => e.id),
    [2, 1, 4],
  );
});

test("pickYourEventButtons: empty input renders nothing", () => {
  assert.deepEqual(pickYourEventButtons([]), []);
});
