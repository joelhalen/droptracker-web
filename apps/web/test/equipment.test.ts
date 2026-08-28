/**
 * The worn-equipment silhouette — `lib/equipment.ts`.
 *
 * These assertions exist because the layout was wrong in production and looked
 * fine: the ring was mapped to container index 11 (not a real OSRS slot, so
 * rings never appeared at all) and the shield was placed where the body sits.
 * A panel that draws the wrong slots still draws *something*, so only an
 * explicit check of the indices and positions catches it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EQUIPMENT_LAYOUT,
  SLOT,
  SLOT_TILE_BASE,
  slotTileUrl,
  type SlotName,
} from "@/lib/equipment";

/** The real `EquipmentInventorySlot` values from the game. */
const GAME_SLOT_INDICES: Record<SlotName, number> = {
  head: 0,
  cape: 1,
  amulet: 2,
  weapon: 3,
  body: 4,
  shield: 5,
  legs: 7,
  hands: 9,
  feet: 10,
  ring: 12,
  ammo: 13,
};

test("slot indices match the game's worn-items container", () => {
  assert.deepEqual(SLOT, GAME_SLOT_INDICES);
});

test("the ring is slot 12 — 11 is not an equipment slot", () => {
  // The original bug, named: an item in the ring slot arrives as slot 12, so a
  // layout keyed on 11 renders an empty tile no matter what the player wore.
  assert.equal(SLOT.ring, 12);
  const indices = Object.values(SLOT) as number[];
  for (const notASlot of [6, 8, 11]) {
    assert.ok(!indices.includes(notASlot), `${notASlot} is not an equipment slot`);
  }
});

test("every equipment slot appears exactly once in the layout", () => {
  const placed = EQUIPMENT_LAYOUT.flat().filter((n): n is SlotName => n !== null);
  assert.equal(placed.length, Object.keys(SLOT).length);
  assert.deepEqual([...placed].sort(), Object.keys(SLOT).sort());
});

test("the layout is a 3-column grid", () => {
  for (const row of EQUIPMENT_LAYOUT) {
    assert.equal(row.length, 3);
  }
});

test("rows follow the game's arrangement", () => {
  assert.deepEqual(EQUIPMENT_LAYOUT, [
    [null, "head", null],
    ["cape", "amulet", "ammo"],
    ["weapon", "body", "shield"],
    [null, "legs", null],
    ["hands", "feet", "ring"],
  ]);
});

test("weapon is left of body and shield is right of it", () => {
  // The specific regression reported: the offhand has to sit beside the torso,
  // not under it.
  const row = EQUIPMENT_LAYOUT.find((r) => r.includes("body"));
  assert.ok(row);
  assert.equal(row!.indexOf("weapon"), 0);
  assert.equal(row!.indexOf("body"), 1);
  assert.equal(row!.indexOf("shield"), 2);
});

test("the ring sits in the bottom row beside hands and feet", () => {
  const bottom = EQUIPMENT_LAYOUT[EQUIPMENT_LAYOUT.length - 1];
  assert.deepEqual(bottom, ["hands", "feet", "ring"]);
});

test("an empty slot shows its own glyph, a filled one the blank tile", () => {
  assert.equal(slotTileUrl("ring", false), `${SLOT_TILE_BASE}/ring.png`);
  assert.equal(slotTileUrl("ring", true), `${SLOT_TILE_BASE}/blank.png`);
});

test("tile urls are relative so the Activity iframe can load them", () => {
  // An absolute www.droptracker.io URL is blocked by the Activity's CSP.
  assert.ok(SLOT_TILE_BASE.startsWith("/"));
  for (const name of Object.keys(SLOT) as SlotName[]) {
    assert.ok(slotTileUrl(name, false).startsWith("/img/"));
  }
});
