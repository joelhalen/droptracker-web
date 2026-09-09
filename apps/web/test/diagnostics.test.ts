import { test } from "node:test";
import assert from "node:assert/strict";
import { GroupDiagnosticsSchema } from "@droptracker/api-types";
import {
  hourLabel,
  localiseHourMatrix,
  peakHour,
  shortDate,
  trendLabel,
} from "../lib/diagnostics";

/**
 * The group diagnostics panel (web111a).
 *
 * The panel it replaces was wrong in three ways that all read as "working":
 * volume came from `notified` (Discord announcements, drops only — ~7/day for a
 * clan tracking 20,000), `members_synced_ts` read a Redis key nothing wrote so
 * every group said "never", and the bar chart's percentages resolved against an
 * indefinite height so the bars were 0px tall. What is pinned here is the
 * shaping the replacement does on top of the payload.
 */

/* -- UTC → local rotation -------------------------------------------------- */

/** `[weekday][hour]`, 0 = Monday. Cell value encodes its own coordinates. */
function coded(): number[][] {
  return Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => d * 100 + h));
}

/** An all-zero 7x24 grid with the given `[weekday, hour, value]` cells set. */
function matrixWith(...cells: [number, number, number][]): number[][] {
  return Array.from({ length: 7 }, (_, d) =>
    Array.from(
      { length: 24 },
      (_, h) => cells.find(([cd, ch]) => cd === d && ch === h)?.[2] ?? 0,
    ),
  );
}

test("localiseHourMatrix: UTC viewers see the matrix unchanged", () => {
  assert.deepEqual(localiseHourMatrix(coded(), 0), coded());
});

test("localiseHourMatrix: a positive offset pulls earlier UTC hours forward", () => {
  // Tokyo (+9): 9am local Monday is midnight UTC Monday.
  const local = localiseHourMatrix(coded(), 9 * 60);
  assert.equal(local[0]![9], 0 * 100 + 0);
  assert.equal(local[0]![23], 0 * 100 + 14);
});

test("localiseHourMatrix: a negative offset wraps back into the previous day", () => {
  // New York (-5): 8pm local Monday is 1am UTC Tuesday.
  const local = localiseHourMatrix(coded(), -5 * 60);
  assert.equal(local[0]![20], 1 * 100 + 1);
});

test("localiseHourMatrix: crossing midnight wraps the weekday, not just the hour", () => {
  // The bug this guards: taking `hour % 24` without carrying the day leaves
  // Monday 08:00 in Tokyo showing Monday 23:00 UTC instead of Sunday's.
  const local = localiseHourMatrix(coded(), 9 * 60);
  assert.equal(local[0]![8], 6 * 100 + 23, "Mon 8am JST is Sun 23:00 UTC");
  const nyc = localiseHourMatrix(coded(), -5 * 60);
  assert.equal(nyc[6]![20], 0 * 100 + 1, "Sun 8pm EST is Mon 01:00 UTC");
});

test("localiseHourMatrix: half-hour zones floor to the hour", () => {
  // India (+5:30). Flooring keeps every cell on a real bucket; rounding to +6
  // would shift the whole evening a slot.
  assert.deepEqual(localiseHourMatrix(coded(), 330), localiseHourMatrix(coded(), 300));
});

test("localiseHourMatrix: always returns a full 7x24 grid", () => {
  // A backend that shipped a ragged or empty matrix must not make the chart
  // index into undefined.
  const ragged = localiseHourMatrix([[1, 2, 3]], 60);
  assert.equal(ragged.length, 7);
  assert.ok(ragged.every((row) => row.length === 24));
  assert.equal(localiseHourMatrix([], -180).flat().reduce((a, b) => a + b, 0), 0);
});

/* -- Peak ------------------------------------------------------------------ */

test("peakHour: finds the busiest cell", () => {
  const m = matrixWith([5, 21, 900], [2, 13, 300]);
  assert.deepEqual(peakHour(m), [5, 21]);
});

test("peakHour: an empty window has no peak rather than a false Monday midnight", () => {
  assert.equal(peakHour(Array.from({ length: 7 }, () => Array(24).fill(0))), null);
  assert.equal(peakHour([]), null);
});

test("peakHour: ties keep the earliest cell so the headline is stable", () => {
  const m = matrixWith([3, 10, 50], [3, 11, 50], [4, 10, 50]);
  assert.deepEqual(peakHour(m), [3, 10]);
});

/* -- Labels ---------------------------------------------------------------- */

test("hourLabel: midnight and noon are not 0am/0pm", () => {
  assert.equal(hourLabel(0), "12am");
  assert.equal(hourLabel(12), "12pm");
  assert.equal(hourLabel(11), "11am");
  assert.equal(hourLabel(13), "1pm");
  assert.equal(hourLabel(23), "11pm");
});

test("shortDate: reads the bucket string instead of parsing it as an instant", () => {
  // `new Date("2026-09-09")` is UTC midnight, which renders as 9/8 anywhere
  // west of Greenwich — the axis would disagree with the tooltip beside it.
  assert.equal(shortDate("2026-09-09"), "9/9");
  assert.equal(shortDate("2026-01-01"), "1/1");
});

/* -- Trend ----------------------------------------------------------------- */

test("trendLabel: reports direction against the previous window", () => {
  assert.equal(trendLabel(110, 100), "+10% vs previous period");
  assert.equal(trendLabel(80, 100), "-20% vs previous period");
  assert.equal(trendLabel(100, 100), "level with previous period");
});

test("trendLabel: an empty baseline yields no claim at all", () => {
  // A clan's first tracked month has nothing to compare against; "+∞%" and
  // "+100%" are both lies.
  assert.equal(trendLabel(5000, 0), null);
  assert.equal(trendLabel(5000, null), null);
  assert.equal(trendLabel(5000, undefined), null);
});

/* -- Contract -------------------------------------------------------------- */

test("diagnostics: a Web API that predates the rich payload still parses", () => {
  // The site and the Web API deploy independently. Without defaults on every
  // added field the whole panel would throw for the length of a staggered
  // deploy, taking the heartbeat down with the charts.
  const legacy = GroupDiagnosticsSchema.parse({
    intake_healthy: true,
    last_submission_ts: 1_700_000_000,
    members_synced_ts: null,
    activity_7d: [{ date: "2026-09-09", submissions: 3 }],
    warnings: [],
  });
  assert.equal(legacy.range_days, 7);
  assert.equal(legacy.totals, null);
  assert.equal(legacy.coverage, null);
  assert.deepEqual(legacy.daily, []);
  assert.deepEqual(legacy.hour_matrix, []);
  assert.equal(legacy.oversized, false);
});

test("diagnostics: the rich payload round-trips", () => {
  const full = GroupDiagnosticsSchema.parse({
    intake_healthy: true,
    last_submission_ts: 1_700_000_000,
    members_synced_ts: 1_699_000_000,
    activity_7d: [],
    warnings: ["No Discord guild linked to this group."],
    range_days: 30,
    generated_ts: 1_700_000_100,
    last_announcement_ts: 1_699_999_000,
    oversized: false,
    totals: { drops: 680_983, gp: 25_632_304_670, announcements: 303, active_players: 92 },
    previous_totals: { drops: 625_267, gp: 21_844_071_170, active_players: 86 },
    daily: [{ date: "2026-09-09", drops: 9_489, gp: 141_896_850, players: 39, announcements: 3 }],
    hour_matrix: Array.from({ length: 7 }, () => Array(24).fill(1)),
    coverage: {
      roster: 342,
      active_7d: 80,
      active_30d: 92,
      active_window: 92,
      tracked_ever: 104,
      hidden: 0,
      ignored: 0,
    },
    kinds: [{ key: "drops", label: "Drops", count: 680_983, last_ts: 1_700_000_000 }],
    top_players: [{ player_id: 1, player_name: "Thall Fe", gp: 3_307_201_736, drops: 3_341 }],
    top_npcs: [{ npc_id: 14_150, npc_name: "Chambers of Xeric", gp: 8_351_680_205, drops: 2_864 }],
  });
  assert.equal(full.range_days, 30);
  assert.equal(full.totals?.drops, 680_983);
  assert.equal(full.coverage?.tracked_ever, 104);
  assert.equal(full.daily[0]!.announcements, 3);
});

test("diagnostics: a day row without announcements defaults to zero", () => {
  // `announcements` is merged in by the backend after the volume query; an
  // older build omitted it entirely and the chart must not read undefined.
  const parsed = GroupDiagnosticsSchema.parse({
    intake_healthy: false,
    last_submission_ts: null,
    members_synced_ts: null,
    activity_7d: [],
    warnings: [],
    daily: [{ date: "2026-09-09", drops: 1, gp: 2, players: 1 }],
  });
  assert.equal(parsed.daily[0]!.announcements, 0);
});
