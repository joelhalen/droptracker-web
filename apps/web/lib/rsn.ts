/**
 * OSRS player-name equivalence.
 *
 * The game treats '-', '_' and ' ' as one character — the hiscores return the
 * same account for "1-19", "1 19" and "1_19" — and the backend usually stores
 * Wise Old Man's folded spelling ("1 19", "tzuk kal lag"). A name typed the way
 * the game shows it only matches once both sides are folded. Mirrors
 * `normalize_player_display_equivalence` in the backend's utils/format.py.
 */

/** Lowercased, with '-' and '_' as spaces and whitespace runs collapsed. */
export function foldRsn(name: string | null | undefined): string {
  return (name ?? "").replace(/[-_]/g, " ").split(/\s+/).filter(Boolean).join(" ").toLowerCase();
}

/**
 * Whether filter `text` occurs in `name` under OSRS name equivalence, so
 * "tzuk-kal" finds "tzuk kal lag". Text that folds to nothing (blank, or only
 * separators) filters nothing out.
 */
export function rsnIncludes(name: string | null | undefined, text: string | null | undefined): boolean {
  const needle = foldRsn(text);
  return !needle || foldRsn(name).includes(needle);
}
