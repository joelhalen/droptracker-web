/**
 * The OSRS worn-equipment silhouette — where each slot sits, and which tile
 * sprite draws it.
 *
 * This is pure data that looks too obvious to get wrong, and was wrong in
 * production for exactly that reason: the layout lived inline in the component
 * with the ring on container index 11. There is no slot 11 in OSRS (the ring
 * is 12), so ring slots silently rendered empty for every player, and the
 * shield sat where the body goes. Nothing failed — the panel just quietly drew
 * the wrong picture. Keeping the mapping here means it is testable, and the
 * tests below are the thing that would have caught it.
 */

/**
 * The game's own worn-items container indices (`EquipmentInventorySlot`).
 * Deliberately sparse: 6, 8 and 11 are not equipment slots.
 */
export const SLOT = {
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
} as const;

export type SlotName = keyof typeof SLOT;

/**
 * The canonical arrangement, row by row, as the game's equipment interface
 * draws it. `null` is a gap in the silhouette, not an empty slot — the middle
 * column is continuous but the outer columns are not.
 */
export const EQUIPMENT_LAYOUT: readonly (readonly (SlotName | null)[])[] = [
  [null, "head", null],
  ["cape", "amulet", "ammo"],
  ["weapon", "body", "shield"],
  [null, "legs", null],
  ["hands", "feet", "ring"],
] as const;

/**
 * The interface sprites, served from the shared image tree so both the site and
 * the Discord Activity resolve them same-origin (see `item-db-icon.tsx` for why
 * an absolute www URL would be blocked in the Activity iframe). Placed on the
 * backend box by `scripts/fetch_equipment_slot_icons.py`.
 */
export const SLOT_TILE_BASE = "/img/equipment";

/** Native size of both the slot tiles and the item sprites, in CSS pixels. */
export const TILE_PX = 36;

/**
 * The tile behind a slot: the slot's own faint glyph when empty, and the plain
 * glyph-free tile when an item covers it — matching how the game swaps them.
 */
export function slotTileUrl(name: SlotName, filled: boolean): string {
  return `${SLOT_TILE_BASE}/${filled ? "blank" : name}.png`;
}
