/**
 * Applying `leaderboard_delta` SSE frames to a loot leaderboard.
 *
 * The backend (`services/realtime.py` publish_drop) only ever publishes PLAYER
 * deltas: `{id: player_id, delta: gp}` on `global`, `group:{id}`,
 * `player:{id}` and `npc:{id}`. So a delta must never touch a groups board:
 * group and player ids share a number space, and a player with id 42 would
 * otherwise bump clan #42's total.
 *
 * Pure (no React) so the reducer is unit-tested; the hook lives in
 * `use-live-leaderboard.ts`.
 */
import type { LeaderboardEntry } from "@droptracker/api-types";

export type LeaderboardDelta = { id: number; delta: number };

/** Parse a frame's data into a delta, or null when it isn't a usable one. */
export function parseLeaderboardDelta(
  type: string,
  data: Record<string, unknown> | undefined,
): LeaderboardDelta | null {
  if (type !== "leaderboard_delta" || !data) return null;
  const id = Number(data.id);
  const delta = Number(data.delta ?? 0);
  if (!Number.isInteger(id) || !Number.isFinite(delta)) return null;
  return { id, delta };
}

/** A total in the backend's `format_number` style (`utils/format.py`), so a
 * patched row reads like its neighbours: 3 decimals for billions, 2 below. */
export function formatLootTotal(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(3)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return Math.max(0, Math.trunc(value)).toLocaleString("en-US");
}

/** The rows with `delta` added to the matching player's loot (and shown as
 * its transient "+X" badge). The formatted total moves with the value; before,
 * only the bar behind it did. Rows are returned unchanged (same array) when
 * the player isn't on this page, so callers can skip a re-render. */
export function applyLeaderboardDelta(
  rows: LeaderboardEntry[],
  { id, delta }: LeaderboardDelta,
): LeaderboardEntry[] {
  if (!rows.some((r) => r.id === id)) return rows;
  return rows.map((r) =>
    r.id === id
      ? {
          ...r,
          loot: { value: r.loot.value + delta, value_formatted: formatLootTotal(r.loot.value + delta) },
          delta,
        }
      : r,
  );
}

/** Clear a row's transient delta once its badge has faded. */
export function clearLeaderboardDelta(rows: LeaderboardEntry[], id: number): LeaderboardEntry[] {
  return rows.map((r) => (r.id === id ? { ...r, delta: undefined } : r));
}
