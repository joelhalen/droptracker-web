import assert from "node:assert/strict";
import { test } from "node:test";
import type { SearchResults } from "@droptracker/api-types";
import {
  ALL_SEARCH_KINDS,
  toSuggestions,
  type SearchKind,
} from "../lib/search-suggestions";

// Both front-ends shape their typeahead through `toSuggestions`, so a change
// here moves the site and the Discord Activity together — which is the whole
// point of the module. These tests pin the behaviour they share.

const player = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: `player-${id}`,
  ...extra,
});
const group = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: `clan-${id}`,
  ...extra,
});
const entity = (id: number) => ({ id, name: `thing-${id}`, icon_url: `/img/${id}.png` });

function results(over: Partial<SearchResults> = {}): SearchResults {
  return {
    players: [],
    groups: [],
    npcs: [],
    items: [],
    ...over,
  } as SearchResults;
}

const idsOf = (kinds: readonly SearchKind[], r: SearchResults) =>
  toSuggestions(r, kinds).map((s) => `${s.kind}:${s.id}`);

test("kinds the caller did not ask for are dropped entirely", () => {
  const r = results({
    players: [player(1)] as SearchResults["players"],
    groups: [group(2)] as SearchResults["groups"],
    npcs: [entity(3)],
    items: [entity(4)],
  });
  assert.deepEqual(idsOf(["players"], r), ["players:1"]);
  assert.deepEqual(idsOf(["groups"], r), ["groups:2"]);
  assert.deepEqual(idsOf(ALL_SEARCH_KINDS, r), [
    "players:1",
    "groups:2",
    "npcs:3",
    "items:4",
  ]);
});

test("a single-kind list is allowed to run longer than it would when mixed", () => {
  const many = Array.from({ length: 12 }, (_, i) => player(i));
  const r = results({ players: many as SearchResults["players"] });
  // Scoped: the whole popup is players, so more of them fit.
  assert.equal(toSuggestions(r, ["players"]).length, 8);
  // Mixed: players have to leave room for the other kinds.
  assert.equal(toSuggestions(r, ALL_SEARCH_KINDS).length, 5);
});

test("kind ordering is players, clans, bosses, items regardless of input order", () => {
  const r = results({
    items: [entity(4)],
    npcs: [entity(3)],
    groups: [group(2)] as SearchResults["groups"],
    players: [player(1)] as SearchResults["players"],
  });
  assert.deepEqual(
    toSuggestions(r, ALL_SEARCH_KINDS).map((s) => s.kind),
    ["players", "groups", "npcs", "items"],
  );
});

test("keys stay unique when different kinds share an id", () => {
  const r = results({
    players: [player(7)] as SearchResults["players"],
    groups: [group(7)] as SearchResults["groups"],
    npcs: [entity(7)],
    items: [entity(7)],
  });
  const keys = toSuggestions(r, ALL_SEARCH_KINDS).map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("the detail line names a rank or a member count, and is null without one", () => {
  const r = results({
    players: [player(1, { global_rank: 12345 }), player(2)] as SearchResults["players"],
    groups: [group(3, { member_count: 1 }), group(4, { member_count: 2400 }), group(5)] as SearchResults["groups"],
  });
  const byId = new Map(toSuggestions(r, ALL_SEARCH_KINDS).map((s) => [s.key, s.detail]));
  assert.equal(byId.get("players-1"), "Global rank #12,345");
  assert.equal(byId.get("players-2"), null);
  // Singular vs plural is the kind of thing that rots silently.
  assert.equal(byId.get("groups-3"), "1 member");
  assert.equal(byId.get("groups-4"), "2,400 members");
  assert.equal(byId.get("groups-5"), null);
});

test("only bosses and items carry an icon; players and clans fall back to a tile", () => {
  const r = results({
    players: [player(1)] as SearchResults["players"],
    npcs: [entity(3)],
  });
  const byKey = new Map(toSuggestions(r, ALL_SEARCH_KINDS).map((s) => [s.key, s.iconUrl]));
  assert.equal(byKey.get("players-1"), null);
  assert.equal(byKey.get("npcs-3"), "/img/3.png");
});

test("a payload missing the optional kinds does not throw", () => {
  // Older API builds omit npcs/items; the Zod default covers the parsed path,
  // but the Activity hands us already-parsed data from its own BFF.
  const bare = { players: [player(1)], groups: [] } as unknown as SearchResults;
  assert.deepEqual(idsOf(ALL_SEARCH_KINDS, bare), ["players:1"]);
});
