import test from "node:test";
import assert from "node:assert/strict";

import {
  describeSplit,
  parseSplitNames,
  resolveSplitSize,
  splitValidationError,
} from "@/components/submit-form";

/**
 * Split handling on the submit form.
 *
 * Origin: a 4-way Tumeken's shadow split where only 3 of the 4 players were on
 * the DropTracker. The divisor collapsed to the people the pipeline could
 * resolve, so a 4-way split paid out thirds. `split_size` is a separate field
 * from the name list precisely so an untracked share still counts.
 *
 * Mirrors the backend's tests/unit/test_web_split_parsing.py and
 * tests/unit/test_manual_discord.py.
 */

test("parses a comma-separated name list", () => {
  assert.deepEqual(parseSplitNames("puzzled life, stuffmyvoid", "WI Beer Guy"), [
    "puzzled life",
    "stuffmyvoid",
  ]);
});

test("tolerates newlines, padding and blank entries", () => {
  assert.deepEqual(parseSplitNames("  a ,,\n b , ", "me"), ["a", "b"]);
});

test("drops the receiver from their own split list", () => {
  assert.deepEqual(parseSplitNames("WI Beer Guy, puzzled life", "WI Beer Guy"), ["puzzled life"]);
  assert.deepEqual(parseSplitNames("wi_beer_guy, puzzled life", "WI Beer Guy"), ["puzzled life"]);
});

test("collapses duplicates across case and underscores", () => {
  assert.deepEqual(parseSplitNames("a, A, a_b, a b", "me"), ["a", "a_b"]);
});

test("empty input is no split", () => {
  assert.deepEqual(parseSplitNames("", "me"), []);
  assert.deepEqual(parseSplitNames("  ,, ", "me"), []);
});

test("size defaults to the people named", () => {
  assert.equal(resolveSplitSize("", 2), 3); // 2 others + receiver
  assert.equal(resolveSplitSize("", 0), undefined); // nobody named, no split
});

test("explicit size counts untracked members — the incident case", () => {
  // 2 named + receiver + 1 unnamed = 4 ways
  assert.equal(resolveSplitSize("4", 2), 4);
});

test("rejects a size that contradicts the names given", () => {
  assert.match(splitValidationError(2, ["a", "b", "c"]) ?? "", /at least 4 ways/);
});

test("rejects an implausible size", () => {
  assert.match(splitValidationError(1, []) ?? "", /between 2 and 100/);
  assert.match(splitValidationError(101, []) ?? "", /between 2 and 100/);
});

test("rejects an over-long RSN", () => {
  assert.match(
    splitValidationError(3, ["a name far too long"]) ?? "",
    /valid RuneScape name/,
  );
});

test("accepts a valid split", () => {
  assert.equal(splitValidationError(4, ["stuffmyvoid", "puzzled life"]), null);
  assert.equal(splitValidationError(undefined, []), null);
});

test("preview spells out shares going to untracked players", () => {
  const text = describeSplit(4, 2, 194_450_000);
  assert.match(text, /Split 4 ways/);
  assert.match(text, /194,450,000 gp each/);
  assert.match(text, /1 share to players not tracked here/);
});

test("preview stays quiet when everyone is accounted for", () => {
  const text = describeSplit(3, 2, null);
  assert.equal(text, "Split 3 ways.");
});

test("the incident numbers come out right", () => {
  // 777,800,000 split 4 ways = 194,450,000 each, not the 259,266,666 a 3-way
  // split would have paid.
  assert.equal(Math.floor(777_800_000 / 4), 194_450_000);
  assert.equal(describeSplit(4, 2, Math.floor(777_800_000 / 4)).includes("194,450,000"), true);
});
