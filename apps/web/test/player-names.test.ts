import assert from "node:assert/strict";
import { test } from "node:test";
import { parseNameList } from "../components/player-add-input";

test("parseNameList splits on commas and newlines", () => {
  assert.deepEqual(parseNameList("alice, bob,carol"), ["alice", "bob", "carol"]);
  assert.deepEqual(parseNameList("alice\nbob\ncarol"), ["alice", "bob", "carol"]);
  assert.deepEqual(parseNameList("alice, bob\ncarol"), ["alice", "bob", "carol"]);
});

test("parseNameList trims and drops empties", () => {
  assert.deepEqual(parseNameList("  alice  ,, ,\n, bob "), ["alice", "bob"]);
  assert.deepEqual(parseNameList(""), []);
  assert.deepEqual(parseNameList(" , \n , "), []);
});

test("parseNameList de-duplicates case-insensitively, keeping first spelling", () => {
  assert.deepEqual(parseNameList("Zezima, zezima, ZEZIMA, bob"), ["Zezima", "bob"]);
});

test("parseNameList keeps in-name spaces (RSNs)", () => {
  assert.deepEqual(parseNameList("lynx titan, hey jase"), ["lynx titan", "hey jase"]);
});
