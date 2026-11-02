/**
 * Pure shaping for the clan stats page (components/group-stats-view.tsx) and
 * its page-builder block. Unit-tested in test/group-stats.test.ts.
 */
import type { GroupStats, GroupStatsMember } from "@droptracker/api-types";
import { formatGp } from "@/lib/format";
import { metricLabel } from "@/lib/osrs-metrics";

export type StatUnit = "gp" | "xp" | "count" | "hours" | "level";

export type MemberColumn = {
  key: keyof GroupStatsMember;
  label: string;
  short: string;
  unit: StatUnit;
  group: ColumnGroup;
  /** Hidden in views where the backend can't know it. */
  needs?: "wom" | "items" | "month";
};

export type ColumnGroup = "loot" | "skilling" | "bossing" | "collecting" | "achievements" | "other";

export const COLUMN_GROUPS: { key: ColumnGroup; label: string }[] = [
  { key: "loot", label: "Loot" },
  { key: "skilling", label: "Skilling" },
  { key: "bossing", label: "Bossing" },
  { key: "collecting", label: "Collecting" },
  { key: "achievements", label: "Achievements" },
  { key: "other", label: "PvP & deaths" },
];

export const MEMBER_COLUMNS: MemberColumn[] = [
  { key: "loot", label: "Loot", short: "Loot", unit: "gp", group: "loot" },
  { key: "drops", label: "Drops", short: "Drops", unit: "count", group: "loot", needs: "items" },
  { key: "xp", label: "XP gained", short: "XP", unit: "xp", group: "skilling", needs: "wom" },
  { key: "levels", label: "Levels gained", short: "Lvls", unit: "count", group: "skilling", needs: "wom" },
  { key: "total_level", label: "Total level", short: "Total", unit: "level", group: "skilling", needs: "wom" },
  { key: "ehp", label: "EHP", short: "EHP", unit: "hours", group: "skilling", needs: "wom" },
  { key: "kills", label: "Boss kills", short: "Kills", unit: "count", group: "bossing", needs: "wom" },
  { key: "ehb", label: "EHB", short: "EHB", unit: "hours", group: "bossing", needs: "wom" },
  { key: "pbs", label: "Personal bests", short: "PBs", unit: "count", group: "bossing" },
  { key: "clog_slots", label: "Log slots", short: "Slots", unit: "count", group: "collecting" },
  { key: "pets", label: "Pets", short: "Pets", unit: "count", group: "collecting" },
  { key: "clues", label: "Clues", short: "Clues", unit: "count", group: "collecting", needs: "wom" },
  { key: "cas", label: "Combat achievements", short: "CAs", unit: "count", group: "achievements" },
  { key: "quests", label: "Quests", short: "Quests", unit: "count", group: "achievements" },
  { key: "diaries", label: "Diaries", short: "Diaries", unit: "count", group: "achievements" },
  { key: "slayer_tasks", label: "Slayer tasks", short: "Slayer", unit: "count", group: "achievements" },
  { key: "pvp_kills", label: "PvP kills", short: "PvP", unit: "count", group: "other" },
  { key: "pvp_loot", label: "PvP loot", short: "PvP gp", unit: "gp", group: "other" },
  { key: "deaths", label: "Deaths", short: "Deaths", unit: "count", group: "other" },
];

/** Columns that mean something for this payload: all-time has no "gained"
 * columns but has total level; month/year the reverse; no WOM, no XP. */
export function availableColumns(stats: GroupStats): MemberColumn[] {
  const wom = stats.coverage.wom !== "missing" && stats.coverage.wom !== "unlinked";
  return MEMBER_COLUMNS.filter((c) => {
    if (c.needs === "wom" && !wom) return false;
    if (c.needs === "items" && !stats.coverage.items) return false;
    if (stats.kind === "all" && c.key === "levels") return false;
    if (stats.kind !== "all" && c.key === "total_level") return false;
    // A column nobody has a number in is noise.
    return stats.members.some((m) => Number(m[c.key] ?? 0) > 0);
  });
}

export function formatStat(value: number | null | undefined, unit: StatUnit): string {
  if (value === null || value === undefined) return "–";
  if (unit === "hours") return value ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "–";
  if (!value) return "–";
  if (unit === "gp" || unit === "xp") return formatGp(value);
  return value.toLocaleString();
}

export function memberName(stats: GroupStats, playerId: number): string {
  return stats.names[String(playerId)] ?? `Player ${playerId}`;
}

export function sortMembers(
  members: GroupStatsMember[],
  key: keyof GroupStatsMember,
  dir: "asc" | "desc",
  names: Record<string, string | null>,
): GroupStatsMember[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...members].sort((a, b) => {
    if (key === "player_id") {
      return sign * (names[String(a.player_id)] ?? "").localeCompare(names[String(b.player_id)] ?? "");
    }
    const av = Number(a[key] ?? 0);
    const bv = Number(b[key] ?? 0);
    if (av !== bv) return sign * (av - bv);
    return (names[String(a.player_id)] ?? "").localeCompare(names[String(b.player_id)] ?? "");
  });
}

export function filterMembers(
  members: GroupStatsMember[],
  names: Record<string, string | null>,
  query: string,
  activeOnly: boolean,
): GroupStatsMember[] {
  const q = query.trim().toLowerCase();
  return members.filter(
    (m) => (!activeOnly || m.active) && (!q || (names[String(m.player_id)] ?? "").toLowerCase().includes(q)),
  );
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The members table as CSV, every available column, raw numbers. */
export function membersCsv(stats: GroupStats, columns: MemberColumn[], members: GroupStatsMember[]): string {
  const header = ["Member", ...columns.map((c) => c.label)];
  const rows = members.map((m) => [memberName(stats, m.player_id), ...columns.map((c) => m[c.key] ?? "")]);
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

/** Everything the payload knows about one member, for the drilldown. */
export function memberDetail(stats: GroupStats, playerId: number) {
  const row = stats.members.find((m) => m.player_id === playerId) ?? null;
  const rankOf = (key: keyof GroupStatsMember) => {
    const value = Number(row?.[key] ?? 0);
    if (!value) return null;
    return stats.members.filter((m) => Number(m[key] ?? 0) > value).length + 1;
  };
  const skills = stats.skills
    .map((s) => {
      const hit = s.members.find((r) => r[0] === playerId);
      return hit ? { metric: s.metric, label: metricLabel(s.metric), xp: hit[1], levels: hit[2] } : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.xp - a.xp);
  const bosses = stats.bosses
    .map((b) => {
      const hit = b.members.find((r) => r[0] === playerId);
      return hit ? { metric: b.metric, label: metricLabel(b.metric), kills: hit[1] } : null;
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .sort((a, b) => b.kills - a.kills);
  const sources = stats.sources
    .map((s) => {
      const hit = s.members.find((r) => r[0] === playerId);
      return hit ? { npc_id: s.npc_id, name: s.name, loot: hit[1], drops: hit[2] } : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.loot - a.loot);
  const items = (stats.member_items[String(playerId)] ?? []).map(([item_id, quantity, loot]) => ({
    item_id,
    quantity,
    loot,
    name: stats.item_names[String(item_id)] ?? `Item ${item_id}`,
  }));
  const feed = feedTimeline(stats).filter((e) => e.player_id === playerId);
  const drops = stats.big_drops.filter((d) => d.player_id === playerId);
  return { row, rankOf, skills, bosses, sources, items, feed, drops };
}

export type FeedKind = keyof GroupStats["feeds"];

export const FEED_KINDS: { key: FeedKind; label: string }[] = [
  { key: "pets", label: "Pets" },
  { key: "clog", label: "Log slots" },
  { key: "pbs", label: "Personal bests" },
  { key: "cas", label: "Combat achievements" },
  { key: "quests", label: "Quests" },
  { key: "diaries", label: "Diaries" },
  { key: "slayer", label: "Slayer tasks" },
  { key: "pvp", label: "PvP kills" },
  { key: "deaths", label: "Deaths" },
];

export type FeedEntry = {
  kind: FeedKind;
  player_id: number;
  date: string | null;
  text: string;
  detail: string | null;
  item_id: number | null;
};

/** Every feed, merged newest first, each entry worded once here. */
export function feedTimeline(stats: GroupStats, kinds?: Set<FeedKind>): FeedEntry[] {
  const out: FeedEntry[] = [];
  const f = stats.feeds;
  const push = (kind: FeedKind, e: { player_id: number; date: string | null }, text: string, detail: string | null = null, item_id: number | null = null) => {
    if (!kinds || kinds.has(kind)) out.push({ kind, player_id: e.player_id, date: e.date, text, detail, item_id });
  };
  for (const e of f.pets) push("pets", e, `got a pet: ${e.name ?? "a pet"}`, null, e.item_id ?? null);
  for (const e of f.clog)
    push("clog", e, `logged ${e.name ?? "a new item"}`, [e.source, e.slots ? `${e.slots} slots` : null].filter(Boolean).join(" · ") || null, e.item_id ?? null);
  for (const e of f.pbs)
    push("pbs", e, `set a PB at ${e.name ?? "a boss"}`, [e.time_ms ? formatPbTime(e.time_ms) : null, e.team_size && e.team_size !== "Solo" ? e.team_size : null].filter(Boolean).join(" · ") || null);
  for (const e of f.cas) push("cas", e, `completed ${e.name ?? "a combat achievement"}`);
  for (const e of f.quests) push("quests", e, `completed ${e.name ?? "a quest"}`);
  for (const e of f.diaries) push("diaries", e, `completed the ${[e.name, e.tier].filter(Boolean).join(" ")} diary`);
  for (const e of f.slayer)
    push("slayer", e, `finished a slayer task: ${e.amount ? `${e.amount} ` : ""}${e.name ?? ""}`.trim(), e.master ?? null);
  for (const e of f.pvp)
    push("pvp", e, `killed ${e.victim ?? "a player"}`, [e.value ? `${formatGp(e.value)} gp` : null, e.wilderness ? `level ${e.wilderness} wildy` : e.location].filter(Boolean).join(" · ") || null);
  for (const e of f.deaths)
    push("deaths", e, e.killer ? `died to ${e.killer}` : "died", [e.location, e.value_lost ? `${formatGp(e.value_lost)} gp lost` : null].filter(Boolean).join(" · ") || null);
  return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** `91_800` ms -> "1:31.8". Same rule as lib/competition formatTimeMs. */
export function formatPbTime(ms: number): string {
  const v = Math.max(Math.floor(ms || 0), 0);
  const total = Math.floor(v / 1000);
  const rem = v % 1000;
  const minutes = Math.floor(total / 60);
  const hours = Math.floor(minutes / 60);
  const seconds = total % 60;
  const mm = hours ? `${hours}:${String(minutes % 60).padStart(2, "0")}` : `${minutes}`;
  const base = `${mm}:${String(seconds).padStart(2, "0")}`;
  return rem ? `${base}.${Math.floor(rem / 100)}` : base;
}

/** "2026-10-14T18:02:00" -> "14 Oct", read off the string (stamps are naive). */
export function shortDate(iso: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(m[3])} ${months[Number(m[2]) - 1] ?? ""}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function periodLabel(period: string): string {
  if (period === "all") return "All time";
  if (period.length === 4) return period;
  const [y, m] = period.split("-");
  return `${MONTH_NAMES[Number(m) - 1] ?? m} ${y}`;
}

/** Every period the picker offers, newest first: months, then years, then all time. */
export function periodOptions(dataSince: string, now = new Date()): { months: string[]; years: string[] } {
  const months: string[] = [];
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth() + 1;
  const [sy, sm] = dataSince.split("-").map(Number) as [number, number];
  while (y > sy || (y === sy && m >= sm)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  const years: string[] = [];
  for (let yr = now.getUTCFullYear(); yr >= sy; yr--) years.push(String(yr));
  return { months, years };
}
