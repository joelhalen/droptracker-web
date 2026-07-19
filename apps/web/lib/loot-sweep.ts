/**
 * Loot Sweep decay math — a faithful mirror of the backend
 * `services/loot_sweep.py` so the authoring preview and the live board show the
 * exact points the engine will award. Keep the two in sync.
 *
 * Receipts are grouped into decay TIERS of `awardsPerTier` each: with 1 every
 * receipt steps down (100/80/60/40/20); with 3 receipts 1-3 are full, 4-6 take
 * the first step, etc.
 */
import type { LootSweepDecayMode } from "@droptracker/api-types";

const DEFAULT_TIERS = 5;

/** Multiplier on an item's base points for its `k`-th receipt (1-indexed). */
export function receiptFactor(
  k: number,
  decayPercent: number,
  awardsPerTier = 1,
  mode: LootSweepDecayMode = "linear",
): number {
  if (k < 1) return 0;
  const apt = Math.max(awardsPerTier || 1, 1);
  const tier = Math.floor((k - 1) / apt);
  if (mode === "geometric") return Math.max(0, (1 - decayPercent / 100) ** tier);
  return Math.max(0, 1 - (tier * decayPercent) / 100);
}

/** Whole points the `k`-th receipt is worth (rounded per receipt, like the
 * backend, so the columns are clean integers). */
export function receiptPoints(
  base: number,
  k: number,
  decayPercent: number,
  awardsPerTier = 1,
  mode: LootSweepDecayMode = "linear",
): number {
  return Math.round(base * receiptFactor(k, decayPercent, awardsPerTier, mode));
}

/** The per-receipt point sequence up to the cap (the preview strip). */
export function decaySequence(
  base: number,
  maxAwards: number,
  decayPercent: number,
  awardsPerTier = 1,
  mode: LootSweepDecayMode = "linear",
): number[] {
  const out: number[] = [];
  for (let k = 1; k <= Math.max(0, maxAwards); k++) {
    out.push(receiptPoints(base, k, decayPercent, awardsPerTier, mode));
  }
  return out;
}

/** Default total scoring receipts when an item doesn't cap itself. */
export function defaultMaxAwards(awardsPerTier = 1): number {
  return DEFAULT_TIERS * Math.max(awardsPerTier || 1, 1);
}

/** Total points an item is worth to a team that received it `count` times
 * (capped at `maxAwards`). Matches `services.loot_sweep.item_points`. */
export function itemTotal(
  base: number,
  count: number,
  maxAwards: number,
  decayPercent: number,
  awardsPerTier = 1,
  mode: LootSweepDecayMode = "linear",
): number {
  const n = Math.min(Math.max(count, 0), Math.max(maxAwards, 0));
  let total = 0;
  for (let k = 1; k <= n; k++) total += receiptPoints(base, k, decayPercent, awardsPerTier, mode);
  return total;
}
