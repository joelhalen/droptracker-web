/** Map a friendly period key to a concrete partition (FRONTEND_PLAN.md §6.5). */
export type PeriodKey = "all" | "month" | "week" | "day";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "All-time" },
  { key: "month", label: "Monthly" },
  { key: "week", label: "Weekly" },
  { key: "day", label: "Daily" },
];

export function resolvePeriod(key: string | undefined): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  switch (key) {
    case "month":
      return `${y}${m}`;
    case "week": {
      const week = Math.ceil(
        ((now.getTime() - Date.UTC(y, 0, 1)) / 86_400_000 +
          new Date(Date.UTC(y, 0, 1)).getUTCDay() +
          1) /
          7,
      );
      return `${y}W${String(week).padStart(2, "0")}`;
    }
    case "day":
      return `${y}${m}${d}`;
    default:
      return "all";
  }
}
