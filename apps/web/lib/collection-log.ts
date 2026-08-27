/**
 * Pure shaping for the collection log grid's per-slot hover card.
 *
 * What a slot can say about itself comes from two sources that disagree by
 * design: `player_clog_items`, refreshed only when the player next opens the
 * log in game, and the `collection` submission the plugin sent the moment the
 * unlock happened. Reconciling them is the only real logic on this page, so it
 * lives here rather than inside the component.
 */
import type { CollectionLogDetail, CollectionLogItem } from "@droptracker/api-types";

/**
 * The status line under a slot's name in its hover card.
 *
 * A slot can be dimmed and still have a submission behind it, because the two
 * sources refresh at different times. Saying "not obtained" directly above
 * "Received today, here is the screenshot" reads as a contradiction, so that
 * case names the real reason instead — the same one the page-level banner
 * gives when the game's slot count runs ahead of what we have recorded.
 */
export function slotStatus(item: CollectionLogItem, detail?: CollectionLogDetail): string {
  if (item.obtained) {
    return item.quantity > 1 ? `Obtained · ×${item.quantity.toLocaleString()}` : "Obtained";
  }
  return detail ? "Not in the last sync" : "Not obtained";
}
