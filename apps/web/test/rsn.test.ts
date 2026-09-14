import assert from "node:assert/strict";
import { test } from "node:test";
import { foldRsn, rsnIncludes } from "../lib/rsn";

test("separators and case fold the way the game compares names", () => {
  assert.equal(foldRsn("1-19"), "1 19");
  assert.equal(foldRsn("1_19"), "1 19");
  assert.equal(foldRsn("Tzuk-Kal-Lag"), "tzuk kal lag");
  assert.equal(foldRsn("  Itz_Baal "), "itz baal");
  assert.equal(foldRsn("1 19"), "1 19");
  assert.equal(foldRsn(null), "");
});

test("a filter typed with the game's spelling finds the stored WOM spelling", () => {
  assert.ok(rsnIncludes("1 19", "1-19"));
  assert.ok(rsnIncludes("tzuk kal lag", "Tzuk-Kal"));
  assert.ok(rsnIncludes("Itz_Baal", "itz baal"));
  assert.ok(rsnIncludes("Solo", "OL"));
});

test("different names stay different", () => {
  assert.ok(!rsnIncludes("1 19", "119"));
  assert.ok(!rsnIncludes("tzuk kal lag", "tzukkal"));
  assert.ok(!rsnIncludes(null, "solo"));
});

test("text that folds to nothing filters nothing", () => {
  for (const text of ["", "   ", "-", "_ -", null, undefined]) {
    assert.ok(rsnIncludes("Solo", text));
  }
});
