import assert from "node:assert/strict";
import { test } from "node:test";
import { cycleActive } from "../lib/listbox";

// Active index cycles through length+1 states: -1 (input itself, no row
// highlighted) then 0..length-1, wrapping at both ends.
test("ArrowDown steps through every row then wraps back to the input", () => {
  assert.equal(cycleActive(-1, 1, 5), 0); // rest → first row
  assert.equal(cycleActive(0, 1, 5), 1);
  assert.equal(cycleActive(3, 1, 5), 4);
  assert.equal(cycleActive(4, 1, 5), -1); // last row → back to input
});

test("ArrowUp steps backwards and wraps to the last row", () => {
  assert.equal(cycleActive(-1, -1, 5), 4); // rest → last row
  assert.equal(cycleActive(4, -1, 5), 3);
  assert.equal(cycleActive(0, -1, 5), -1); // first row → back to input
});

test("single-row list toggles between the input and the row", () => {
  assert.equal(cycleActive(-1, 1, 1), 0);
  assert.equal(cycleActive(0, 1, 1), -1);
  assert.equal(cycleActive(-1, -1, 1), 0);
  assert.equal(cycleActive(0, -1, 1), -1);
});
