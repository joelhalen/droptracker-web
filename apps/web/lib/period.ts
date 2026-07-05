/** Map a friendly period key to a concrete partition (FRONTEND_PLAN.md §6.5). */
export type PeriodKey = "all" | "month" | "week" | "day";

/** Monthly is the primary view — the tracking system works month-to-month, so
 * it leads the list and is the default period everywhere (FRONTEND_PLAN.md §6.5). */
export const DEFAULT_PERIOD: PeriodKey = "month";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "month", label: "Monthly" },
  { key: "week", label: "Weekly" },
  { key: "day", label: "Daily" },
  { key: "all", label: "All-time" },
];

export function resolvePeriod(key: string | undefined): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const month = `${y}${m}`;
  switch (key) {
    case "all":
      return "all";
    case "week": {
      // ISO-8601 week, matching the backend's datetime.isocalendar() tokens
      // (utils/partitions.py week_token). The ISO week-year can differ from the
      // calendar year around January 1st, so both come from the same Thursday.
      const thursday = new Date(Date.UTC(y, now.getUTCMonth(), now.getUTCDate()));
      thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
      const isoYear = thursday.getUTCFullYear();
      const week = Math.ceil(
        ((thursday.getTime() - Date.UTC(isoYear, 0, 1)) / 86_400_000 + 1) / 7,
      );
      return `${isoYear}W${String(week).padStart(2, "0")}`;
    }
    case "day":
      return `${y}${m}${d}`;
    case "month":
    default:
      // Unknown/absent periods fall back to the current month, never all-time.
      return month;
  }
}
