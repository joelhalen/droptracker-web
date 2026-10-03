/**
 * Stat-tile hints for a player profile, shared by the site page and the
 * Discord Activity so the two read the same figures the same way.
 */

/** "Top 3%" style hint for the global-rank tile; only when meaningfully high. */
export function percentileHint(rank?: number, ranked?: number): string | undefined {
  if (!rank || !ranked || ranked < 100) return undefined;
  const pct = (rank / ranked) * 100;
  if (pct > 50) return undefined;
  const display = pct < 1 ? Math.max(0.1, Math.round(pct * 10) / 10) : Math.ceil(pct);
  return `Top ${display}% of ${ranked.toLocaleString()} players`;
}

/** Month-over-month movement for the loot tile. */
export function momDelta(
  current?: number,
  previous?: number,
): { text: string; up: boolean } | undefined {
  if (current == null || previous == null || previous <= 0) return undefined;
  const change = ((current - previous) / previous) * 100;
  if (!Number.isFinite(change) || Math.abs(change) < 1) return undefined;
  const rounded = Math.round(Math.abs(change));
  return { text: `${change > 0 ? "+" : "−"}${rounded}% vs last month`, up: change > 0 };
}
