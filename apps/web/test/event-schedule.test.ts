import assert from "node:assert/strict";
import { test } from "node:test";
import { EventScheduleInputSchema, EventScheduleStateSchema } from "@droptracker/api-types";
import {
  describeSchedule,
  materializeSchedule,
  matchPreset,
  scheduleStatusAt,
} from "@/lib/event-schedule";

// web82a: the builder previews a recurring schedule client-side so an
// organizer sees the windows they're creating without a round trip per
// keystroke. These assertions pin the port to the backend's
// services/event_schedule.py — if it drifts, the preview quietly lies.

/** Unix seconds for a UTC wall-clock instant. */
const utc = (y: number, m: number, d: number, hh = 0, mm = 0) =>
  Math.floor(Date.UTC(y, m - 1, d, hh, mm) / 1000);

const WEEKEND = {
  type: "weekly" as const,
  windows: [{ start_dow: 5, start_time: "00:00", end_dow: 0, end_time: "00:00" }],
  interval_weeks: 1,
  month_ordinal: null,
};

test("weekly weekends produce one window per weekend inside the span", () => {
  // Aug 2026: the 1st is a Saturday, so a whole-month span holds 5 weekends
  // (the last one is clamped by the event's end).
  const { windows, error } = materializeSchedule(
    WEEKEND,
    utc(2026, 8, 1),
    utc(2026, 9, 1),
  );
  assert.equal(error, null);
  assert.equal(windows.length, 5);
  assert.equal(windows[0]!.starts_at, utc(2026, 8, 1));
  assert.equal(windows[0]!.ends_at, utc(2026, 8, 3));
  // Every window opens on a Saturday and closes on the following Monday.
  for (const w of windows) {
    assert.equal(new Date(w.starts_at * 1000).getUTCDay(), 6);
  }
});

test("interval_weeks:2 keeps every other weekend, anchored on the first", () => {
  const { windows } = materializeSchedule(
    { ...WEEKEND, interval_weeks: 2 },
    utc(2026, 8, 1),
    utc(2026, 9, 1),
  );
  assert.deepEqual(
    windows.map((w) => w.starts_at),
    [utc(2026, 8, 1), utc(2026, 8, 15), utc(2026, 8, 29)],
  );
});

test("month_ordinal:1 keeps only the first weekend of each month", () => {
  const { windows } = materializeSchedule(
    { ...WEEKEND, month_ordinal: 1 },
    utc(2026, 8, 10),
    utc(2026, 11, 1),
  );
  // August's first weekend precedes the start date and clamps away entirely.
  assert.deepEqual(
    windows.map((w) => w.starts_at),
    [utc(2026, 9, 5), utc(2026, 10, 3)],
  );
});

test("month_ordinal:-1 keeps the last occurrence of each month", () => {
  const { windows } = materializeSchedule(
    { ...WEEKEND, month_ordinal: -1 },
    utc(2026, 8, 1),
    utc(2026, 10, 1),
  );
  assert.deepEqual(
    windows.map((w) => w.starts_at),
    [utc(2026, 8, 29), utc(2026, 9, 26)],
  );
});

test("a daily window whose end precedes its start crosses midnight", () => {
  const { windows } = materializeSchedule(
    { type: "daily", start_time: "22:00", end_time: "02:00" },
    utc(2026, 8, 1),
    utc(2026, 8, 4),
  );
  // The window opening the evening BEFORE the start clamps to the start.
  assert.equal(windows[0]!.starts_at, utc(2026, 8, 1));
  assert.equal(windows[0]!.ends_at, utc(2026, 8, 1, 2));
  assert.equal(windows[1]!.starts_at, utc(2026, 8, 1, 22));
  assert.equal(windows[1]!.ends_at, utc(2026, 8, 2, 2));
});

test("overlapping windows merge and everything clamps to the event span", () => {
  const { windows } = materializeSchedule(
    {
      type: "custom",
      windows: [
        { start: utc(2026, 8, 1), end: utc(2026, 8, 3) },
        { start: utc(2026, 8, 2), end: utc(2026, 8, 5) },
        { start: utc(2026, 7, 1), end: utc(2026, 7, 2) }, // entirely before the span
      ],
    },
    utc(2026, 8, 1),
    utc(2026, 8, 4),
  );
  assert.deepEqual(windows, [{ starts_at: utc(2026, 8, 1), ends_at: utc(2026, 8, 4) }]);
});

test("a rule that never opens inside the span reports the API's complaint", () => {
  const { windows, error } = materializeSchedule(
    { ...WEEKEND },
    utc(2026, 8, 3), // Monday
    utc(2026, 8, 6), // Thursday — no Saturday in between
  );
  assert.equal(windows.length, 0);
  assert.match(error ?? "", /never opens/);
});

test("a schedule without both dates is refused before the round trip", () => {
  assert.match(materializeSchedule(WEEKEND, null, utc(2026, 9, 1)).error ?? "", /start and an end/);
  assert.equal(materializeSchedule(null, null, null).error, null);
});

test("describeSchedule matches the backend's summary wording", () => {
  assert.equal(describeSchedule(WEEKEND), "Weekly: Sat 00:00 → Mon 00:00 UTC");
  assert.equal(
    describeSchedule({ ...WEEKEND, interval_weeks: 2 }),
    "Weekly: Sat 00:00 → Mon 00:00 UTC, every other week",
  );
  assert.equal(
    describeSchedule({ ...WEEKEND, month_ordinal: -1 }),
    "Weekly: Sat 00:00 → Mon 00:00 UTC, the last occurrence each month",
  );
  assert.equal(
    describeSchedule({ type: "daily", start_time: "19:00", end_time: "23:00" }),
    "Daily: 19:00 → 23:00 UTC",
  );
});

test("matchPreset recognises the one-click rules", () => {
  assert.equal(matchPreset(WEEKEND), "weekends");
  assert.equal(matchPreset({ ...WEEKEND, interval_weeks: 2 }), "alternate_weekends");
  assert.equal(matchPreset({ ...WEEKEND, month_ordinal: 1 }), "first_weekend");
  assert.equal(matchPreset({ type: "daily", start_time: "20:00", end_time: "23:00" }), null);
});

test("scheduleStatusAt answers open/paused from the compiled windows", () => {
  const windows = [
    { starts_at: 1000, ends_at: 2000 },
    { starts_at: 5000, ends_at: 6000 },
  ];
  assert.deepEqual(scheduleStatusAt(windows, 1500), {
    open: true,
    current: windows[0]!,
    next: windows[1]!,
  });
  assert.deepEqual(scheduleStatusAt(windows, 3000), {
    open: false,
    current: null,
    next: windows[1]!,
  });
  assert.deepEqual(scheduleStatusAt(windows, 9000), { open: false, current: null, next: null });
});

test("the schedule contract accepts the API's shapes and defaults the clock", () => {
  const input = EventScheduleInputSchema.parse({ rule: WEEKEND });
  assert.equal(input.tz, "UTC");
  const state = EventScheduleStateSchema.parse({
    rule: WEEKEND,
    tz: "UTC",
    summary: "Weekly: Sat 00:00 → Mon 00:00 UTC",
    window_count: 1,
    windows: [{ starts_at: 1, ends_at: 2 }],
    scoring_open: true,
    current_window: { starts_at: 1, ends_at: 2 },
    next_window: null,
  });
  assert.equal(state.rule?.type, "weekly");
  // A rule shape this client doesn't understand degrades to null rather than
  // failing the whole event payload.
  assert.equal(EventScheduleStateSchema.parse({ rule: { type: "lunar" } }).rule, null);
});
