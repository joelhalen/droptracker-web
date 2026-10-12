/**
 * "Prime time" on the recap card (components/recap-card.tsx): when a player or
 * clan actually plays, read from the recap's `activity` histograms.
 *
 * Both histograms count active hours — one player looting in one clock hour —
 * so a 4.5M drop weighs the same as a 4gp one. They used to sum GP, which made
 * prime time the hour of the month's biggest drop (bug report #191).
 */

/** What `activity` counts when it can be read as play time — the backend's
 *  `ACTIVITY_WEIGHT`. Older snapshots summed GP per hour instead, which made
 *  "Prime time" the hour the biggest drop landed; those are never displayed. */
export const ACTIVITY_WEIGHT = "active_hours";

/** A prime time is a habit, not one session: the peak hour must have been
 *  active on at least this many days (member-days, for a clan). */
export const MIN_PRIME_HOUR_DAYS = 3;

/**
 * The hour played most, or null when nothing recurs. `byHour[h]` counts the
 * days someone was looting at h:00. Ties — common on a light month — go to
 * the hour whose neighbours were busier, i.e. the middle of the usual session
 * rather than whichever tied hour comes first on the clock.
 */
export function primeHourOf(byHour: number[]): number | null {
  if (byHour.length !== 24) return null;
  const around = (h: number) => byHour[(h + 23) % 24]! + byHour[(h + 1) % 24]!;
  let best = 0;
  for (let h = 1; h < 24; h++) {
    const d = byHour[h]! - byHour[best]!;
    if (d > 0 || (d === 0 && around(h) > around(best))) best = h;
  }
  return byHour[best]! >= MIN_PRIME_HOUR_DAYS ? best : null;
}

/** The weekday with the most hours played — only when it clearly leads. A
 *  tie would name one of two days arbitrarily, so it names neither. */
export function primeDayOf(byWeekday: number[]): number | null {
  if (byWeekday.length !== 7) return null;
  let best = 0;
  for (let d = 1; d < 7; d++) if (byWeekday[d]! > byWeekday[best]!) best = d;
  const top = byWeekday[best]!;
  return top > 0 && byWeekday.filter((v) => v === top).length === 1 ? best : null;
}
