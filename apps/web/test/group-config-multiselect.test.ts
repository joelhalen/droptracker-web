import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GroupConfigPatchSchema,
  SLAYER_MASTER_OPTIONS,
  formatMultiselect,
  getConfigField,
  parseMultiselect,
} from "@droptracker/api-types";

/**
 * `multiselect` config fields store the chosen option values comma-separated,
 * in option order, with "" meaning none. The backend's coerce_multiselect
 * writes the same form, so a value saved here reads back unchanged and a
 * re-save is never an edit.
 */

const masters = getConfigField("slayer_excluded_masters")!;

test("the slayer master picker is a multiselect over every master, skipping Turael and Spria by default", () => {
  assert.equal(masters.type, "multiselect");
  assert.equal(masters.options, SLAYER_MASTER_OPTIONS);
  assert.deepEqual(
    parseMultiselect(String(masters.default)).map(
      (v) => SLAYER_MASTER_OPTIONS.find((o) => o.value === v)?.label,
    ),
    ["Turael / Aya", "Spria"],
  );
});

test("formatMultiselect writes option order whatever order the boxes were ticked in", () => {
  assert.equal(formatMultiselect(masters, ["9", "1"]), "1,9");
  assert.equal(formatMultiselect(masters, new Set(["10", "5", "1"])), "1,5,10");
  assert.equal(formatMultiselect(masters, []), "");
  // An option the field doesn't have is dropped rather than stored.
  assert.equal(formatMultiselect(masters, ["1", "42"]), "1");
});

test("parseMultiselect reads the stored form, blanks and spacing included", () => {
  assert.deepEqual(parseMultiselect("1,9"), ["1", "9"]);
  assert.deepEqual(parseMultiselect(" 1 , 9 ,"), ["1", "9"]);
  assert.deepEqual(parseMultiselect(""), []);
});

test("a PATCH may skip nobody, but not name a master that doesn't exist", () => {
  const ok = (value: string) =>
    GroupConfigPatchSchema.safeParse({ slayer_excluded_masters: value }).success;
  assert.equal(ok(""), true);
  assert.equal(ok("1,9"), true);
  assert.equal(ok("1,5,10"), true);
  assert.equal(ok("11"), false);
  assert.equal(ok("Turael"), false);
});
