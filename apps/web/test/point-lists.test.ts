import assert from "node:assert/strict";
import { test } from "node:test";
import type { EventItemSourceNpc, PointListEntry } from "@droptracker/api-types";
import { groupEntries, listEntryPayload, sourceNpcIds } from "@/lib/point-lists";

/**
 * The bug behind these: a stored list row matches only when BOTH its item and
 * its NPC match, and contracts from Yama are recorded against the reward
 * container ("Dossier"). A blacklist row of "Contract of shard acquisition" +
 * "Yama" therefore matched nothing and the item kept awarding points. What the
 * editor sends has to make that unrepresentable.
 */

const src = (npc_id: number, name: string, extra: Partial<EventItemSourceNpc> = {}) =>
  ({
    npc_id,
    name,
    icon_url: `https://www.droptracker.io/img/npcdb/${npc_id}.png`,
    quantity: "1",
    rarity: 0.01,
    rolls: 1,
    tracked: true,
    ...extra,
  }) satisfies EventItemSourceNpc;

const row = (e: Partial<PointListEntry>): PointListEntry => ({
  id: 1,
  list_type: "blacklist",
  item_id: null,
  item_name: null,
  npc_id: null,
  npc_name: null,
  ...e,
});

const ITEM = { id: 30828 };
const DOSSIER = src(232324, "Dossier");
const YAMA = src(14176, "Yama");

// --- listEntryPayload --------------------------------------------------------

test("all sources selected stores no NPC at all", () => {
  // The regression guard: enumerating today's sources would silently exclude a
  // source first seen tomorrow, which is exactly how the container/boss split
  // bit us. Untouched selection = unrestricted.
  const body = listEntryPayload({
    listType: "blacklist",
    item: ITEM,
    npc: null,
    sources: [DOSSIER, YAMA],
    excluded: [],
  });
  assert.deepEqual(body, { list_type: "blacklist", item_id: 30828, npc_id: null });
  assert.equal("npc_ids" in body, false);
});

test("deselecting a source restricts the entry to the rest", () => {
  const body = listEntryPayload({
    listType: "blacklist",
    item: ITEM,
    npc: null,
    sources: [DOSSIER, YAMA],
    excluded: [YAMA.npc_id],
  });
  assert.deepEqual(body.npc_ids, [232324]);
  assert.equal(body.item_id, 30828);
});

test("a single-source item is unrestricted either way", () => {
  // There is no choice to express, and one row keeps matching if a second
  // source ever shows up.
  for (const excluded of [[], [DOSSIER.npc_id]]) {
    const body = listEntryPayload({
      listType: "blacklist",
      item: ITEM,
      npc: null,
      sources: [DOSSIER],
      excluded,
    });
    assert.equal(body.npc_ids, undefined);
  }
});

test("deselecting every source falls back to unrestricted rather than nothing", () => {
  // The editor blocks this, but an entry that matches nothing would be worse
  // than one that matches everything the admin asked to list.
  const body = listEntryPayload({
    listType: "blacklist",
    item: ITEM,
    npc: null,
    sources: [DOSSIER, YAMA],
    excluded: [DOSSIER.npc_id, YAMA.npc_id],
  });
  assert.equal(body.npc_ids, undefined);
  assert.equal(body.npc_id, null);
});

test("an alias source contributes every real npc id it merged", () => {
  const wintertodt = src(13974, "Wintertodt", {
    members: ["Reward cart (Wintertodt)", "Supply crate (Wintertodt)"],
    member_ids: [13974, 20693],
  });
  assert.deepEqual(sourceNpcIds(wintertodt), [13974, 20693]);
  const body = listEntryPayload({
    listType: "blacklist",
    item: { id: 20718 },
    npc: null,
    sources: [wintertodt, YAMA],
    excluded: [YAMA.npc_id],
  });
  // Not just the alias's icon representative — the supply crate has to be
  // listed too or half its drops still award points.
  assert.deepEqual(body.npc_ids, [13974, 20693]);
});

test("an NPC-only entry keeps its npc_id", () => {
  const body = listEntryPayload({
    listType: "no_split",
    item: null,
    npc: { id: 14176 },
    sources: null,
    excluded: [],
  });
  assert.deepEqual(body, { list_type: "no_split", item_id: null, npc_id: 14176 });
});

test("a picked item never rides along with a standalone NPC", () => {
  // The two are alternatives in the editor; ANDing them is the original bug.
  const body = listEntryPayload({
    listType: "blacklist",
    item: ITEM,
    npc: { id: 14176 },
    sources: null,
    excluded: [],
  });
  assert.equal(body.npc_id, null);
});

// --- groupEntries ------------------------------------------------------------

test("rows for one item's sources read back as a single entry", () => {
  const groups = groupEntries([
    row({ id: 1, item_id: 30828, item_name: "Contract", npc_id: 232324, npc_name: "Dossier" }),
    row({ id: 2, item_id: 30828, item_name: "Contract", npc_id: 14176, npc_name: "Yama" }),
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0]?.sources.map((s) => s.name),
    ["Dossier", "Yama"],
  );
  // Removing the entry has to remove every row behind it.
  assert.deepEqual(
    groups[0]?.rows.map((r) => r.id),
    [1, 2],
  );
});

test("an unrestricted row stays separate from the same item's restricted ones", () => {
  // It matches on its own regardless of the others, so folding it into their
  // chip list would misreport what the entry blocks.
  const groups = groupEntries([
    row({ id: 1, item_id: 30828, item_name: "Contract", npc_id: null }),
    row({ id: 2, item_id: 30828, item_name: "Contract", npc_id: 232324, npc_name: "Dossier" }),
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0]?.sources, []);
  assert.equal(groups[1]?.sources.length, 1);
});

test("different items never merge", () => {
  const groups = groupEntries([
    row({ id: 1, item_id: 30828, npc_id: 232324, npc_name: "Dossier" }),
    row({ id: 2, item_id: 30825, npc_id: 232324, npc_name: "Dossier" }),
  ]);
  assert.equal(groups.length, 2);
});

test("NPC-only rows stay one entry each", () => {
  const groups = groupEntries([
    row({ id: 1, npc_id: 14176, npc_name: "Yama" }),
    row({ id: 2, npc_id: 232324, npc_name: "Dossier" }),
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((g) => g.npcName),
    ["Yama", "Dossier"],
  );
});
