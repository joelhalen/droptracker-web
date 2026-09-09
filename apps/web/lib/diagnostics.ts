/**
 * Pure shaping for the group diagnostics panel (web111a).
 *
 * The Web API measures activity in UTC — `player_npc_hourly_totals.date_hour`
 * is a `YYYY-MM-DD-HH` string built from the server clock — but "when is my
 * clan online" is a question about the admin's own clock. The rotation below is
 * the only piece of that with edge cases worth pinning, so it lives here rather
 * than inside the chart component.
 */

/** Weekday index used throughout: 0 = Monday … 6 = Sunday (SQL `WEEKDAY()`). */
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * Rotate a UTC `[weekday][hour]` matrix into a viewer's local frame.
 *
 * A whole-hour offset is a pure shift: local hour `h` on local weekday `d` holds
 * whatever was in the UTC cell `offsetMinutes` earlier, wrapping the weekday
 * when the shift crosses midnight (Sunday 23:00 UTC is Monday 08:00 in Tokyo).
 *
 * Sub-hour zones (India at +5:30, Chatham at +12:45) are floored to the hour:
 * the heatmap answers "which evening", and thirty minutes does not change that
 * answer. DST inside the window is likewise absorbed — the matrix is already a
 * sum across several weeks, so an hour of smearing is invisible next to the
 * shape it is there to show.
 *
 * Returns a fresh 7x24 matrix even when the input is ragged or empty, so the
 * chart never has to guard its own indexing.
 */
export function localiseHourMatrix(matrix: number[][], offsetMinutes: number): number[][] {
  const shift = Math.floor(offsetMinutes / 60);
  return Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => {
      const utcHour = h - shift;
      const dayShift = Math.floor(utcHour / 24);
      const wrappedHour = ((utcHour % 24) + 24) % 24;
      const wrappedDay = (((d + dayShift) % 7) + 7) % 7;
      return matrix[wrappedDay]?.[wrappedHour] ?? 0;
    }),
  );
}

/**
 * The busiest cell as `[weekday, hour]`, or null when nothing was tracked.
 *
 * Ties keep the earliest cell in Mon→Sun, 00→23 order, so the headline is
 * stable across re-renders of the same data.
 */
export function peakHour(matrix: number[][]): [number, number] | null {
  let best: [number, number] | null = null;
  let bestValue = 0;
  matrix.forEach((row, d) =>
    row.forEach((v, h) => {
      if (v > bestValue) {
        bestValue = v;
        best = [d, h];
      }
    }),
  );
  return best;
}

/** 12-hour clock label for an hour index ("12am", "7pm"). */
export function hourLabel(h: number): string {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

/**
 * `M/D` label for a `YYYY-MM-DD` bucket.
 *
 * Split rather than `new Date(iso)`: a bare date string parses as UTC midnight,
 * which renders as the *previous* day for every viewer west of Greenwich — the
 * axis would disagree with the tooltip beside it.
 */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/**
 * Signed percentage change against the preceding window of the same length, or
 * null when that window was empty — a clan's first month has no baseline, and
 * "+∞%" is not a diagnostic.
 */
export function trendLabel(current: number, previous: number | null | undefined): string | null {
  if (previous == null || previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return "level with previous period";
  return `${pct > 0 ? "+" : ""}${pct}% vs previous period`;
}
