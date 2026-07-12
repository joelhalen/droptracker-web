import assert from "node:assert/strict";
import { test } from "node:test";
import { slugify, isNumericId, entityPath } from "../lib/slug";

test("slugify matches the backend rule", () => {
  assert.equal(slugify("Awesome Clan"), "awesome-clan");
  assert.equal(slugify("Twisted bow"), "twisted-bow");
  assert.equal(slugify("Vet'ion"), "vet-ion");
  assert.equal(slugify("Tumeken's Warden"), "tumeken-s-warden");
  assert.equal(slugify("  Spaced  Out  "), "spaced-out");
  assert.equal(slugify("Zezima"), "zezima");
  // Leading/trailing and repeated separators collapse and trim.
  assert.equal(slugify("!!!Hooray!!!"), "hooray");
  assert.equal(slugify("a---b"), "a-b");
  // Unslugifiable / empty names → "".
  assert.equal(slugify("!!!"), "");
  assert.equal(slugify(""), "");
  assert.equal(slugify(null), "");
  assert.equal(slugify(undefined), "");
});

test("isNumericId only matches bare digit strings", () => {
  assert.equal(isNumericId("123"), true);
  assert.equal(isNumericId("0"), true);
  assert.equal(isNumericId("vorkath"), false);
  assert.equal(isNumericId("12a"), false);
  assert.equal(isNumericId("12-3"), false);
  assert.equal(isNumericId(""), false);
});

test("entityPath prefers the pretty slug, falls back to id", () => {
  assert.equal(entityPath("groups", 42, "Awesome Clan"), "/groups/awesome-clan");
  assert.equal(entityPath("players", 7, "Zezima"), "/players/zezima");
  assert.equal(entityPath("npcs", 8060, "Vorkath"), "/npcs/vorkath");
  assert.equal(entityPath("items", 20997, "Twisted bow"), "/items/twisted-bow");
  // No / empty name → id url.
  assert.equal(entityPath("players", 7), "/players/7");
  assert.equal(entityPath("groups", 9, "!!!"), "/groups/9");
  assert.equal(entityPath("items", 5, null), "/items/5");
});
