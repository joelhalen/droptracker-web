import type { ClanLog, ClanLogItem, ClanLogSection } from "@droptracker/api-types";

/**
 * Pure shaping for the Clan Log board. Kept out of the component so the
 * grouping, ordering and label rules are unit-testable — the same split
 * `lib/loot-sweep-matrix.ts` makes for the event board.
 */

/** Display order. Anything the backend adds later falls to the end, in payload order. */
const CATEGORY_ORDER = [
  "raids",
  "gwd",
  "desert_treasure",
  "bosses",
  "slayer",
  "wilderness",
  "group_bosses",
  "misc",
];

const CATEGORY_LABELS: Record<string, string> = {
  raids: "Raids",
  gwd: "God Wars Dungeon",
  desert_treasure: "Desert Treasure II",
  bosses: "Bosses",
  slayer: "Slayer",
  wilderness: "Wilderness",
  group_bosses: "Multi-boss sets",
  misc: "Miscellaneous",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, " ");
}

export type ClanLogCategory = {
  key: string;
  label: string;
  sections: ClanLogSection[];
  total: number;
  obtained: number;
  pct: number;
};

/** Bucket the flat section list into the board's collapsible category blocks. */
export function groupByCategory(sections: ClanLogSection[]): ClanLogCategory[] {
  const buckets = new Map<string, ClanLogSection[]>();
  for (const section of sections) {
    const list = buckets.get(section.category);
    if (list) list.push(section);
    else buckets.set(section.category, [section]);
  }

  return [...buckets.entries()]
    .map(([key, list]) => {
      const total = list.reduce((n, s) => n + s.total, 0);
      const obtained = list.reduce((n, s) => n + s.obtained, 0);
      return {
        key,
        label: categoryLabel(key),
        sections: list,
        total,
        obtained,
        pct: total ? Math.round((1000 * obtained) / total) / 10 : 0,
      };
    })
    .sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.key);
      const bi = CATEGORY_ORDER.indexOf(b.key);
      return (ai < 0 ? CATEGORY_ORDER.length : ai) - (bi < 0 ? CATEGORY_ORDER.length : bi);
    });
}

/** "all" → "All time", "2026" → "2026", "2026-08" → "August 2026". */
export function formatClanLogPeriod(period: string): string {
  if (period === "all") return "All time";
  if (/^\d{4}$/.test(period)) return period;
  const [year, month] = period.split("-");
  const index = Number(month) - 1;
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return names[index] ? `${names[index]} ${year}` : period;
}

/**
 * The slots still to hunt — the "bounty" list the suggestion asked for.
 *
 * Pets are excluded: they never arrive as a drop, so their absence is not the
 * same kind of fact as a missing drop and they would pad a work list with
 * things nobody can deliberately farm as loot.
 */
export function missingItems(
  sections: ClanLogSection[],
): { section: string; item: ClanLogItem }[] {
  const out: { section: string; item: ClanLogItem }[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (!item.obtained && item.attributable) out.push({ section: section.label, item });
    }
  }
  return out;
}

/** Colour ramp for a completion figure. Mirrors the Discord card's bars. */
export function completionTone(pct: number): string {
  if (pct >= 100) return "text-osrs-gold-bright";
  if (pct >= 75) return "text-emerald-400";
  if (pct >= 40) return "text-osrs-gold";
  return "text-osrs-parchment-dark";
}

/** Short "12 Aug 2026" for a hover card; the payload carries ISO strings. */
export function formatObtainedAt(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Headline counts, tolerant of an older payload missing a field. */
export function boardSummary(board: ClanLog) {
  const { total, obtained, pct } = board.summary;
  return { total, obtained, pct, missing: Math.max(0, total - obtained) };
}
