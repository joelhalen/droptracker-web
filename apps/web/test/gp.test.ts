import assert from "node:assert/strict";
import { test } from "node:test";
import { describeGp, formatGpShorthand, MAX_GP, parseGp } from "../lib/gp";

// The point of the field: the shorthand players already type in game and in the
// Discord onboarding modal now works on the website too.
test("in-game shorthand resolves to whole gp", () => {
  assert.equal(parseGp("1.5m"), 1_500_000);
  assert.equal(parseGp("100k"), 100_000);
  assert.equal(parseGp("1b"), 1_000_000_000);
  assert.equal(parseGp("50kk"), 50_000_000); // "two k's" is a million in game
  assert.equal(parseGp("2500000"), 2_500_000);
});

// Matches the backend's parse_gp (disc/services/group_onboarding_panel.py),
// which is what a group admin gets if they set the same key over Discord.
test("backend parity: the cases parse_gp is tested against", () => {
  assert.equal(parseGp("2500000"), 2_500_000);
  assert.equal(parseGp("2.5m"), 2_500_000);
  assert.equal(parseGp("500k"), 500_000);
  assert.equal(parseGp("1b"), 1_000_000_000);
  assert.equal(parseGp("2,500,000"), 2_500_000);
  assert.equal(parseGp("-5"), null);
  assert.equal(parseGp("abc"), null);
});

test("formatting noise a user can reasonably paste is tolerated", () => {
  assert.equal(parseGp("  1.5M  "), 1_500_000);
  assert.equal(parseGp("1,500,000"), 1_500_000);
  assert.equal(parseGp("1.5m gp"), 1_500_000);
  assert.equal(parseGp("25 000 000"), 25_000_000);
});

// Scaling by shifting the decimal, not multiplying floats: 2.3 * 1e6 is
// 2299999.9999999995, and truncating that would silently lose a gp.
test("decimal shorthand is exact, not float-scaled", () => {
  assert.equal(parseGp("2.3m"), 2_300_000);
  assert.equal(parseGp("1.1m"), 1_100_000);
  assert.equal(parseGp("0.07m"), 70_000);
  assert.equal(parseGp("8.7b"), 8_700_000_000);
  assert.equal(parseGp(".5m"), 500_000);
});

// Whole coins only: a GP field can't store a fraction, and rounding up would
// hand someone a value they didn't type.
test("sub-unit fractions truncate toward zero", () => {
  assert.equal(parseGp("1.9999k"), 1_999);
  assert.equal(parseGp("1.2345678m"), 1_234_567);
  assert.equal(parseGp("0.5"), 0);
});

test("an emptied field never parses as a number", () => {
  assert.equal(parseGp(""), null);
  assert.equal(parseGp("   "), null);
  assert.notEqual(Number(""), null); // the trap this replaces
});

test("mid-edit junk is rejected rather than coerced", () => {
  for (const raw of ["-", ".", "m", "1.2.3", "--5", "5x", "1e6", "1kb", "k100", "Infinity"]) {
    assert.equal(parseGp(raw, { min: null }), null, raw);
  }
});

test("bounds reject out-of-range input, so the field can revert", () => {
  assert.equal(parseGp("-5m", { min: 0 }), null);
  assert.equal(parseGp("-5m", { min: null }), -5_000_000);
  assert.equal(parseGp("2m", { max: 1_000_000 }), null);
  assert.equal(parseGp("1m", { max: 1_000_000 }), 1_000_000);
});

// Beyond 2^53 the digits stop being trustworthy, and the backend's buy-in
// ledger caps at 10^15 anyway.
test("values too large to represent exactly are rejected", () => {
  assert.equal(parseGp("999999999999999999999"), null);
  assert.equal(parseGp("9999b"), 9_999_000_000_000);
  assert.equal(parseGp(String(MAX_GP)), MAX_GP);
  assert.equal(parseGp("1000b", { max: MAX_GP }), 1_000_000_000_000);
});

// The box shows shorthand back, so a saved value reads without counting zeros.
test("shorthand display round-trips exactly or falls back to digits", () => {
  assert.equal(formatGpShorthand(2_500_000), "2.5m");
  assert.equal(formatGpShorthand(100_000), "100k");
  assert.equal(formatGpShorthand(1_000_000_000), "1b");
  assert.equal(formatGpShorthand(1_234_567), "1234567"); // no exact shorthand
  assert.equal(formatGpShorthand(2_500), "2500"); // too small to be worth it
  assert.equal(formatGpShorthand(0), "0");
});

test("every displayed shorthand parses back to the value it came from", () => {
  for (const v of [0, 1, 999, 10_000, 25_000, 2_500_000, 1_234_567, 8_700_000_000, MAX_GP]) {
    assert.equal(parseGp(formatGpShorthand(v)), v, `round-trip ${v}`);
  }
});

// What the user reads under the field to confirm what will be saved.
test("the preview spells out the exact number, abbreviating only when it helps", () => {
  assert.equal(describeGp(1_500_000), "1,500,000 gp (1.50M)");
  assert.equal(describeGp(500), "500 gp");
  assert.equal(describeGp(0), "0 gp");
  assert.equal(describeGp(25_000_000, "xp"), "25,000,000 xp (25.00M)");
});
