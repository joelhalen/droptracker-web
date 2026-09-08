import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRecapAccounts, parseRecapAccounts } from "../lib/recap-accounts";

test("blank is the default, all is all", () => {
  assert.deepEqual(parseRecapAccounts(""), { mode: "best", ids: [] });
  assert.deepEqual(parseRecapAccounts(undefined), { mode: "best", ids: [] });
  assert.deepEqual(parseRecapAccounts("  "), { mode: "best", ids: [] });
  assert.deepEqual(parseRecapAccounts("all"), { mode: "all", ids: [] });
  assert.deepEqual(parseRecapAccounts(" ALL "), { mode: "all", ids: [] });
});

test("one id and many, in the order written, duplicates and junk dropped", () => {
  assert.deepEqual(parseRecapAccounts("12"), { mode: "some", ids: [12] });
  assert.deepEqual(parseRecapAccounts("34, 12"), { mode: "some", ids: [34, 12] });
  assert.deepEqual(parseRecapAccounts("12,12,x,34"), { mode: "some", ids: [12, 34] });
});

test("nothing usable reads as the default, never as nothing", () => {
  assert.deepEqual(parseRecapAccounts("banana"), { mode: "best", ids: [] });
  assert.deepEqual(parseRecapAccounts(",,"), { mode: "best", ids: [] });
});

test("canonical form is sorted and deduplicated; a single id stores bare", () => {
  assert.equal(formatRecapAccounts("some", [34, 12, 34]), "12,34");
  assert.equal(formatRecapAccounts("some", [12]), "12");
  assert.equal(formatRecapAccounts("some", []), "");
  assert.equal(formatRecapAccounts("all"), "all");
  assert.equal(formatRecapAccounts("best"), "");
});

test("round trip matches the backend's stored strings", () => {
  for (const value of ["", "all", "12", "12,34"]) {
    const { mode, ids } = parseRecapAccounts(value);
    assert.equal(formatRecapAccounts(mode, ids), value);
  }
  const { mode, ids } = parseRecapAccounts("34,12");
  assert.equal(formatRecapAccounts(mode, ids), "12,34");
});
