import { test } from "node:test";
import assert from "node:assert/strict";
import { GroupStatsSchema } from "@droptracker/api-types";
import {
  availableColumns,
  feedTimeline,
  filterMembers,
  formatPbTime,
  formatStat,
  memberDetail,
  membersCsv,
  periodLabel,
  periodOptions,
  sortMembers,
} from "../lib/group-stats";
import { metricIconUrl, metricLabel } from "../lib/osrs-metrics";

/** Clan stats page shaping (suggestion #224). */

const member = (player_id: number, extra: Record<string, number | boolean> = {}) => ({
  player_id, loot: 0, drops: 0, pbs: 0, clog_slots: 0, cas: 0, pets: 0, quests: 0, diaries: 0,
  deaths: 0, slayer_tasks: 0, pvp_kills: 0, pvp_loot: 0, active: true, ...extra,
});

const STATS = GroupStatsSchema.parse({
  group: { id: 363, name: "Venture Clan", wom_linked: true },
  period: "2026-10",
  kind: "month",
  months: ["2026-10"],
  in_progress: false,
  data_since: "2024-10",
  generated_at: "2026-11-02T13:00:00",
  coverage: { wom: "stored", wom_months: ["2026-10"], sources: true, items: true },
  names: { "1": "Buzzyn", "2": "Ettuflu", "3": "Quiet One" },
  totals: { members_total: 3, members_active: 2, loot: 300 },
  members: [
    member(1, { loot: 200, xp: 5000, levels: 2, kills: 10 }),
    member(2, { loot: 100, xp: 9000, pets: 1 }),
    member(3, { active: false }),
  ],
  standouts: { categories: [], skills: [], bosses: [] },
  skills: [{ metric: "woodcutting", total: 14000, levels: 2, members: [[2, 9000, 1], [1, 5000, 1]], member_count: 2 }],
  bosses: [{ metric: "zulrah", total: 10, members: [[1, 10]], member_count: 1 }],
  sources: [{ npc_id: 2042, name: "Zulrah", loot: 200, drops: 4, members: [[1, 200, 4]], member_count: 1 }],
  items: [],
  member_items: { "1": [[12922, 1, 150]] },
  item_names: { "12922": "Tanzanite fang" },
  big_drops: [],
  feeds: {
    pets: [{ player_id: 2, date: "2026-10-20T10:00:00", item_id: 13321, name: "Rock golem" }],
    pbs: [{ player_id: 1, date: "2026-10-25T10:00:00", name: "Zulrah", time_ms: 51_000, team_size: "Solo" }],
  },
  activity: null,
});

test("columns only appear when someone has a number in them", () => {
  const keys = availableColumns(STATS).map((c) => c.key);
  assert.ok(keys.includes("loot") && keys.includes("xp") && keys.includes("pets"));
  assert.ok(!keys.includes("deaths") && !keys.includes("total_level"));
});

test("no Wise Old Man, no XP columns", () => {
  const keys = availableColumns({ ...STATS, coverage: { ...STATS.coverage, wom: "unlinked" } }).map((c) => c.key);
  assert.ok(!keys.includes("xp") && !keys.includes("kills"));
});

test("sort, filter and export", () => {
  const byXp = sortMembers(STATS.members, "xp", "desc", STATS.names);
  assert.deepEqual(byXp.map((m) => m.player_id), [2, 1, 3]);
  const byName = sortMembers(STATS.members, "player_id", "asc", STATS.names);
  assert.deepEqual(byName.map((m) => m.player_id), [1, 2, 3]);
  assert.equal(filterMembers(STATS.members, STATS.names, "", true).length, 2);
  assert.equal(filterMembers(STATS.members, STATS.names, "ett", false).length, 1);
  const csv = membersCsv(STATS, availableColumns(STATS), byXp).split("\n");
  assert.equal(csv[0]!.split(",")[0], "Member");
  assert.ok(csv[1]!.startsWith("Ettuflu,100,"));
});

test("a member's drilldown reads every breakdown", () => {
  const d = memberDetail(STATS, 1);
  assert.equal(d.rankOf("loot"), 1);
  assert.equal(d.rankOf("xp"), 2);
  assert.deepEqual(d.skills.map((s) => s.metric), ["woodcutting"]);
  assert.equal(d.bosses[0]?.kills, 10);
  assert.equal(d.sources[0]?.name, "Zulrah");
  assert.equal(d.items[0]?.name, "Tanzanite fang");
  assert.equal(d.feed.length, 1);
});

test("the feed merges newest first and words each entry", () => {
  const all = feedTimeline(STATS);
  assert.equal(all[0]?.kind, "pbs");
  assert.match(all[0]!.text, /set a PB at Zulrah/);
  assert.equal(all[0]?.detail, "0:51");
  assert.equal(feedTimeline(STATS, new Set(["pets"])).length, 1);
});

test("formatting", () => {
  assert.equal(formatStat(0, "count"), "–");
  assert.equal(formatStat(null, "gp"), "–");
  assert.equal(formatStat(2_500_000, "gp"), "2.50M");
  assert.equal(formatStat(1.25, "hours"), "1.3");
  assert.equal(formatPbTime(3_723_400), "1:02:03.4");
  assert.equal(periodLabel("2026-10"), "October 2026");
  assert.equal(periodLabel("all"), "All time");
});

test("period options run from this month back to when tracking began", () => {
  const { months, years } = periodOptions("2024-10", new Date(Date.UTC(2026, 10, 2)));
  assert.equal(months[0], "2026-11");
  assert.equal(months[months.length - 1], "2024-10");
  assert.equal(months.length, 26);
  assert.deepEqual(years, ["2026", "2025", "2024"]);
});

test("metric labels and icons", () => {
  assert.equal(metricLabel("chambers_of_xeric"), "Chambers of Xeric");
  assert.equal(metricLabel("tzkal_zuk"), "TzKal-Zuk");
  assert.equal(metricIconUrl("zulrah"), "/img/metrics/zulrah.png");
  assert.equal(metricIconUrl("brutus"), null);
});
