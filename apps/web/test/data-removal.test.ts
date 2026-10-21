import assert from "node:assert/strict";
import { test } from "node:test";
import { DataRemovalRequestSchema, type DataRemovalRequest } from "@droptracker/api-types";
import { formatUtc, namesMatch, removalStatusText } from "../lib/data-removal";

const base: DataRemovalRequest = {
  id: 7,
  kind: "player",
  subject_id: 5,
  subject_name: "Of Fury",
  status: "awaiting_verification",
  ticket_id: 494,
  verification_phrase: "DropTracker removal 123456",
  purge_after: null,
  created_at: 1760961600,
  decided_at: null,
  completed_at: null,
  can_cancel: true,
};

test("typed name matches with OSRS separator equivalence, like the backend", () => {
  assert.ok(namesMatch("of_fury", "Of Fury"));
  assert.ok(namesMatch("  OF-FURY ", "Of Fury"));
  assert.ok(!namesMatch("Of Fur", "Of Fury"));
  assert.ok(!namesMatch("", ""));
});

test("scheduled requests name the purge time in UTC", () => {
  const text = removalStatusText({ ...base, status: "scheduled", purge_after: 1761566400 });
  assert.match(text, /Oct 27, 2025.*UTC/);
  assert.match(text, /cancel/);
});

test("every status has wording", () => {
  for (const status of DataRemovalRequestSchema.shape.status.options) {
    assert.ok(removalStatusText({ ...base, status }).length > 0, status);
  }
});

test("formatUtc is empty for a missing time", () => {
  assert.equal(formatUtc(null), "");
});

test("schema accepts the backend payload shape", () => {
  assert.deepEqual(DataRemovalRequestSchema.parse(base), base);
});
