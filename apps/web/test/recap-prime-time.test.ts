import { test } from "node:test";
import assert from "node:assert/strict";
import { RecapSchema } from "@droptracker/api-types";
import { ACTIVITY_WEIGHT, primeDayOf, primeHourOf } from "../lib/recap-prime-time";

/**
 * "Prime time" on the recap card (bug report #191).
 *
 * The histograms used to sum GP, so one 4.5M clue at 04:25 UTC made 04:00 the
 * prime time of a month played in the mornings and evenings. They now count
 * active hours; what is pinned here is how the card reads them.
 */

const hours = (cells: Record<number, number>) =>
  Array.from({ length: 24 }, (_, h) => cells[h] ?? 0);

test("the reporter's September: the hour played most often, not the richest", () => {
  // Active days per hour for JoelsOnSkype, 2026-09, after the backfill.
  const byHour = hours({ 0: 1, 2: 2, 4: 2, 5: 3, 7: 4, 8: 3, 17: 1, 18: 1, 19: 1, 21: 2, 22: 3, 23: 2 });
  assert.equal(primeHourOf(byHour), 7);
});

test("a peak that never recurs is not a prime time", () => {
  // One long session: every hour active on exactly one day.
  assert.equal(primeHourOf(hours({ 2: 1, 3: 1, 4: 1, 5: 1 })), null);
  assert.equal(primeHourOf(hours({ 20: 2, 21: 2 })), null);
  assert.equal(primeHourOf(hours({})), null);
});

test("ties go to the middle of the usual session, across midnight too", () => {
  // 21, 22 and 23 tie; 22 sits between two busy hours.
  assert.equal(primeHourOf(hours({ 21: 3, 22: 3, 23: 3, 9: 3 })), 22);
  // 23 and 0 tie; 0's neighbour at 01 is busier than 23's at 22.
  assert.equal(primeHourOf(hours({ 22: 1, 23: 5, 0: 5, 1: 4 })), 0);
});

test("malformed histograms show nothing", () => {
  assert.equal(primeHourOf([5, 5, 5]), null);
  assert.equal(primeDayOf([1, 2, 3]), null);
});

test("the weekday hint names a day only when it clearly leads", () => {
  // Monday-first. Tuesday and Saturday tie at 5 → no hint.
  assert.equal(primeDayOf([1, 5, 4, 4, 3, 5, 3]), null);
  assert.equal(primeDayOf([1, 6, 4, 4, 3, 5, 3]), 1);
  assert.equal(primeDayOf([0, 0, 0, 0, 0, 0, 0]), null);
});

test("the payload's weight survives schema parsing", () => {
  // zod strips unknown keys, and the card refuses activity without the stamp —
  // so dropping `weight` from the schema would silently hide every prime time.
  const parsed = RecapSchema.parse({
    scope: "player",
    period: "2026-09",
    schema_version: 1,
    totals: {},
    activity: { by_hour: hours({ 7: 4 }), by_weekday: [0, 0, 0, 0, 0, 0, 0], weight: ACTIVITY_WEIGHT },
  });
  assert.equal(parsed.activity?.weight, ACTIVITY_WEIGHT);
});
