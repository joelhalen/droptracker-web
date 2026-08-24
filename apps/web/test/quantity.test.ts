import assert from "node:assert/strict";
import { test } from "node:test";
import { parseQuantity } from "../lib/quantity";

// The whole point of the helper: an empty box is "no value", never 0. The old
// `Number(e.target.value)` / `parseInt(...) || 1` handlers made numeric fields
// impossible to clear, because deleting the last digit wrote a number back in.
test("an emptied field never parses as a number", () => {
  assert.equal(parseQuantity(""), null);
  assert.equal(parseQuantity("   "), null);
  assert.notEqual(Number(""), null); // the trap this replaces
});

test("mid-edit junk is rejected rather than coerced", () => {
  for (const raw of ["-", "e", "1e", "abc", "1.2.3", "--5"]) {
    assert.equal(parseQuantity(raw, { min: null }), null, raw);
  }
});

test("values inside the bounds come back as numbers", () => {
  assert.equal(parseQuantity("250", { min: 1 }), 250);
  assert.equal(parseQuantity(" 7 ", { min: 1 }), 7);
  assert.equal(parseQuantity("0", { min: 0 }), 0);
});

test("out-of-range input is rejected, so the field can revert to its last good value", () => {
  assert.equal(parseQuantity("0", { min: 1 }), null);
  assert.equal(parseQuantity("401", { min: 10, max: 400 }), null);
  assert.equal(parseQuantity("400", { min: 10, max: 400 }), 400);
});

test("null bounds mean unbounded, which is how ± fields accept negatives", () => {
  assert.equal(parseQuantity("-500", { min: null }), -500);
  assert.equal(parseQuantity("-500", {}), null); // default min is 1
  assert.equal(parseQuantity("999999999", { min: null, max: null }), 999999999);
});

test("integer fields reject decimals; weight fields accept them", () => {
  assert.equal(parseQuantity("2.5", { min: 0 }), null);
  assert.equal(parseQuantity("2.5", { min: 0, integer: false }), 2.5);
});
