import type { PointsLeaderboardEntry } from "@droptracker/api-types";

/**
 * Pure shaping for the group points leaderboard page: the one URL builder every
 * link and the search box share, and how a combined row names the accounts
 * behind its total. Kept out of the page so it can be tested without a render.
 */

/** Longest search the backend accepts (`MAX_LEADERBOARD_QUERY`); an RSN is 12. */
export const MAX_LEADERBOARD_QUERY = 40;

export type LeaderboardParams = {
  period?: string;
  q?: string;
  page?: number;
};

/**
 * `base` is the group's own path in whatever form the visitor arrived by (slug
 * or id). Defaults are left out of the URL so the canonical board stays
 * `…/points/leaderboard`, and a search always lands on page 1 — page 3 of the
 * full board means nothing once the list has been narrowed.
 */
export function leaderboardHref(base: string, params: LeaderboardParams = {}): string {
  const qs = new URLSearchParams();
  if (params.period && params.period !== "month") qs.set("period", params.period);
  const q = normalizeQuery(params.q);
  if (q) qs.set("q", q);
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  const suffix = qs.toString();
  return `${base}/points/leaderboard${suffix ? `?${suffix}` : ""}`;
}

/** Trimmed, whitespace-collapsed and capped the way the backend will read it. */
export function normalizeQuery(q: string | undefined | null): string {
  return (q ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_LEADERBOARD_QUERY);
}

/**
 * The accounts behind a row other than the one it is shown under — empty on a
 * per-RSN board, and for a combined row whose other accounts are all hidden.
 */
export function otherAccounts(entry: PointsLeaderboardEntry) {
  return entry.accounts.filter((a) => a.id !== entry.id);
}

/** Points earned by the account the row is shown under (its share of a
 * combined total; the whole total on a per-RSN board). */
export function primaryShare(entry: PointsLeaderboardEntry): number {
  return entry.accounts.find((a) => a.id === entry.id)?.points ?? entry.points;
}

/** Whether the row is a Discord user's several RSNs rather than a single one. */
export function isCombinedRow(entry: PointsLeaderboardEntry): boolean {
  return otherAccounts(entry).length > 0;
}

/**
 * Which part of a name the search matched, for highlighting. Mirrors the
 * backend's OSRS name equivalence ('-', '_' and ' ' are one character, case is
 * ignored) so what is highlighted is what was matched; null when the name is
 * not the one that matched (a combined row found through a different account).
 */
export function matchRange(name: string, q: string): [number, number] | null {
  const fold = (s: string) => s.toLowerCase().replace(/[-_]/g, " ");
  const needle = fold(normalizeQuery(q));
  if (!needle) return null;
  const at = fold(name).indexOf(needle);
  return at < 0 ? null : [at, at + needle.length];
}
