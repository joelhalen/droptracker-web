/**
 * EHE (Efficient Hours towards Event) captioning. The numbers come from the server; these helpers only
 * decide how they read — and the readings that matter are the honest ones:
 * a sub-hour grind must not round away to nothing, and an unpriceable boss
 * must not read as "did nothing".
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { EventEffort } from "@droptracker/api-types";
import { effortSummary, formatEheHours } from "@/lib/events";

function effort(over: Partial<EventEffort> = {}): EventEffort {
  return {
    ehb_hours: 0,
    ehb_estimated_hours: 0,
    kills: 0,
    bosses: [],
    boss_count: 0,
    last_at: null,
    frozen: 0,
    ...over,
  };
}

test("formatEheHours keeps sub-hour effort visible as minutes", () => {
  // 0.4h at a boss is a real session; "0h" would say the opposite.
  assert.equal(formatEheHours(0.4), "24m");
  assert.equal(formatEheHours(0.99), "59m");
  // Anything non-zero rounds to at least a minute rather than to "0m".
  assert.equal(formatEheHours(0.001), "1m");
});

test("formatEheHours drops precision as the number grows", () => {
  assert.equal(formatEheHours(1), "1.0h");
  assert.equal(formatEheHours(7.06), "7.1h");
  assert.equal(formatEheHours(12.4), "12h");
  assert.equal(formatEheHours(1234.5), "1,235h");
});

test("formatEheHours renders nothing-to-price as an em dash, not a zero", () => {
  // 0 EHB means "no rate we can price this with" as often as it means "idle" —
  // the kill count is shown separately and tells the real story.
  assert.equal(formatEheHours(0), "—");
  assert.equal(formatEheHours(null), "—");
  assert.equal(formatEheHours(undefined), "—");
  assert.equal(formatEheHours(Number.NaN), "—");
  assert.equal(formatEheHours(-3), "—");
});

test("formatEheHours marks derived-rate estimates with a tilde", () => {
  // Hours priced with DropTracker-derived rates (bosses WOM doesn't price)
  // must never pose as the standard number — thread #93's labelling promise.
  assert.equal(formatEheHours(12.4, true), "~12h");
  assert.equal(formatEheHours(1, true), "~1.0h");
  assert.equal(formatEheHours(0.4, true), "~24m");
  // Nothing to price stays an em dash — a tilde on a dash would be noise.
  assert.equal(formatEheHours(0, true), "—");
  // Explicit false is the plain label.
  assert.equal(formatEheHours(12.4, false), "12h");
});

test("effortSummary glosses the EHB figure in plain kills", () => {
  assert.equal(effortSummary(effort({ kills: 1, boss_count: 1 })), "1 kill");
  assert.equal(effortSummary(effort({ kills: 240, boss_count: 1 })), "240 kills");
  assert.equal(
    effortSummary(effort({ kills: 520, boss_count: 2 })),
    "520 kills at 2 bosses",
  );
});

test("effortSummary says so when there is nothing yet", () => {
  assert.equal(effortSummary(effort()), "No tracked kills yet");
  assert.equal(effortSummary(null), "No tracked kills yet");
  assert.equal(effortSummary(undefined), "No tracked kills yet");
});

test("effortSummary falls back to the boss list when boss_count is absent", () => {
  const e = effort({ kills: 30, bosses: [{} as never, {} as never] });
  delete (e as Partial<EventEffort>).boss_count;
  assert.equal(effortSummary(e), "30 kills at 2 bosses");
});
