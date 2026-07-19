/**
 * Loot Sweep decay math — a faithful mirror of the backend
 * `services/loot_sweep.py` so the authoring preview and the live board show the
 * exact points the engine will award. Keep the two in sync.
 */
import type { LootSweepDecayMode } from "@droptracker/api-types";

/** Multiplier on an item's base points for its `k`-th receipt (1-indexed). */
export function receiptFactor(
  k: number,
  decayPercent: number,
  mode: LootSweepDecayMode = "linear",
): number {
  if (k < 1) return 0;
  if (mode === "geometric") return Math.max(0, (1 - decayPercent / 100) ** (k - 1));
  return Math.max(0, 1 - ((k - 1) * decayPercent) / 100);
}

/** Whole points the `k`-th receipt of an item is worth (rounded per receipt,
 * like the backend, so the columns are clean integers). */
export function receiptPoints(
  base: number,
  k: number,
  decayPercent: number,
  mode: LootSweepDecayMode = "linear",
): number {
  return Math.round(base * receiptFactor(k, decayPercent, mode));
}

/** The full per-receipt point sequence up to the cap (the grid columns). */
export function decaySequence(
  base: number,
  maxAwards: number,
  decayPercent: number,
  mode: LootSweepDecayMode = "linear",
): number[] {
  const out: number[] = [];
  for (let k = 1; k <= Math.max(0, maxAwards); k++) {
    out.push(receiptPoints(base, k, decayPercent, mode));
  }
  return out;
}

/** Total points an item is worth to a team that received it `count` times
 * (capped at `maxAwards`). Matches `services.loot_sweep.item_points`. */
export function itemTotal(
  base: number,
  count: number,
  maxAwards: number,
  decayPercent: number,
  mode: LootSweepDecayMode = "linear",
): number {
  const n = Math.min(Math.max(count, 0), Math.max(maxAwards, 0));
  let total = 0;
  for (let k = 1; k <= n; k++) total += receiptPoints(base, k, decayPercent, mode);
  return total;
}
