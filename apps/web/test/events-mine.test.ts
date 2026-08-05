import assert from "node:assert/strict";
import { test } from "node:test";
import { EventSummarySchema } from "@droptracker/api-types";
import { mockEvents, mockEventsMine } from "../lib/mock-data";

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
