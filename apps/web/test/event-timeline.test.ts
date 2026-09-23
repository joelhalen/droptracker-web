import assert from "node:assert/strict";
import { test } from "node:test";
import { EventSummarySchema, type EventSummary } from "@droptracker/api-types";
import {
  buildTimelineBands,
  eventTypeLabel,
  groupByMonth,
  liveDayLabel,
  liveProgress,
  pickStripRows,
  resolveEventsView,
  stripBars,
  stripPos,
  stripTicks,
  stripWindow,
  timelineIsEmpty,
} from "../lib/event-timeline";

const DAY = 86_400;
const NOW = 1_790_000_000; // a fixed instant; nothing here reads the clock

function ev(over: Partial<EventSummary> & { id: number }): EventSummary {
  return EventSummarySchema.parse({
    group_id: 101,
    name: `Event ${over.id}`,
    status: "active",
    starts_at: NOW - DAY,
    ends_at: NOW + DAY,
    ...over,
  });
}

const utcMidnight = (t: number) => Math.floor(t / DAY) * DAY;

// ── Bands ───────────────────────────────────────────────────────────────────

test("buildTimelineBands: dedupes across lists, first copy wins, bands in reading order", () => {
  const mine = ev({ id: 1, name: "From your events", status: "draft", starts_at: NOW + 5 * DAY });
  const dup = ev({ id: 1, name: "From upcoming", status: "draft", starts_at: NOW + 5 * DAY });
  const b = buildTimelineBands(
    [mine],
    [dup, ev({ id: 2, status: "draft", starts_at: NOW + 2 * DAY }), ev({ id: 3, status: "draft", starts_at: null })],
    [ev({ id: 4, ends_at: NOW + 9 * DAY }), ev({ id: 5, ends_at: NOW + 3 * DAY })],
    [ev({ id: 6, status: "past", ends_at: NOW - 9 * DAY }), ev({ id: 7, status: "past", ends_at: NOW - DAY })],
  );
  assert.deepEqual(b.live.map((e) => e.id), [5, 4]);
  assert.deepEqual(b.upcoming.map((e) => e.id), [2, 1]);
  assert.equal(b.upcoming[1]!.name, "From your events");
  assert.deepEqual(b.undated.map((e) => e.id), [3]);
  assert.deepEqual(b.past.map((e) => e.id), [7, 6]);
});

test("timelineIsEmpty: only when every band is empty", () => {
  assert.ok(timelineIsEmpty(buildTimelineBands([], [], [])));
  assert.ok(!timelineIsEmpty(buildTimelineBands([ev({ id: 1, status: "past" })])));
  assert.ok(!timelineIsEmpty(buildTimelineBands([ev({ id: 1, status: "draft", starts_at: null })])));
});

// ── Labels ──────────────────────────────────────────────────────────────────

test("eventTypeLabel: kinds and the standard+bingo case", () => {
  assert.equal(eventTypeLabel({ kind: "sotw", has_bingo: false }), "Skill of the Week");
  assert.equal(eventTypeLabel({ kind: "botw", has_bingo: false }), "Boss of the Week");
  assert.equal(eventTypeLabel({ kind: "board_game", has_bingo: false }), "Board game");
  assert.equal(eventTypeLabel({ kind: "standard", has_bingo: true }), "Bingo");
  assert.equal(eventTypeLabel({ kind: "standard", has_bingo: false }), "Task race");
});

test("liveProgress: fraction of the window, clamped; null when open-ended", () => {
  assert.equal(liveProgress({ starts_at: NOW - 3 * DAY, ends_at: NOW + DAY }, NOW), 0.75);
  assert.equal(liveProgress({ starts_at: NOW + DAY, ends_at: NOW + 2 * DAY }, NOW), 0);
  assert.equal(liveProgress({ starts_at: NOW - 2 * DAY, ends_at: NOW - DAY }, NOW), 1);
  assert.equal(liveProgress({ starts_at: NOW - DAY, ends_at: null }, NOW), null);
  // Activated early without a scheduled start: falls back to activated_at.
  assert.equal(liveProgress({ starts_at: null, activated_at: NOW - DAY, ends_at: NOW + DAY }, NOW), 0.5);
});

test("liveDayLabel: counts from day 1; skipped for short or open-ended events", () => {
  assert.equal(liveDayLabel({ starts_at: NOW - 2.5 * DAY, ends_at: NOW + 4.5 * DAY }, NOW), "Day 3 of 7");
  assert.equal(liveDayLabel({ starts_at: NOW - 60, ends_at: NOW + 7 * DAY }, NOW), "Day 1 of 8");
  assert.equal(liveDayLabel({ starts_at: NOW - 3600, ends_at: NOW + 3600 }, NOW), null);
  assert.equal(liveDayLabel({ starts_at: NOW - DAY, ends_at: null }, NOW), null);
});

// ── Strip ───────────────────────────────────────────────────────────────────

test("stripWindow: baseline two weeks either side; stretches within limits", () => {
  assert.deepEqual(stripWindow([], NOW), { from: NOW - 14 * DAY, to: NOW + 14 * DAY });
  const w = stripWindow(
    [
      ev({ id: 1, starts_at: NOW - 30 * DAY, ends_at: NOW + DAY }),
      ev({ id: 2, status: "draft", starts_at: NOW + 70 * DAY, ends_at: NOW + 77 * DAY }),
    ],
    NOW,
  );
  assert.equal(w.from, NOW - 31 * DAY);
  assert.equal(w.to, NOW + 78 * DAY);
  const capped = stripWindow(
    [
      ev({ id: 1, starts_at: NOW - 400 * DAY }),
      ev({ id: 2, status: "draft", starts_at: NOW + 400 * DAY }),
    ],
    NOW,
  );
  assert.deepEqual(capped, { from: NOW - 60 * DAY, to: NOW + 120 * DAY });
});

test("stripBars: positions, clipping, open ends, and what can't be placed", () => {
  const w = { from: NOW - 10 * DAY, to: NOW + 10 * DAY };
  const bars = stripBars(
    [
      ev({ id: 1, starts_at: NOW - 20 * DAY, ends_at: NOW }), // clipped at the start
      ev({ id: 2, status: "draft", starts_at: NOW + 5 * DAY, ends_at: null }), // one-day stub
      ev({ id: 3, starts_at: NOW - 2 * DAY, ends_at: null }), // live, open-ended
      ev({ id: 4, status: "draft", starts_at: null }), // no start: not on the strip
      ev({ id: 5, status: "past", starts_at: NOW - 40 * DAY, ends_at: NOW - 30 * DAY }), // off-window
    ],
    w,
    NOW,
  );
  assert.deepEqual(bars.map((b) => b.event.id), [1, 3, 2]);
  const [a, open, stub] = [bars[0]!, bars[1]!, bars[2]!];
  assert.equal(a.left, 0);
  assert.equal(a.width, 50);
  assert.ok(a.clippedStart && !a.clippedEnd && !a.openEnded);
  assert.ok(open.openEnded);
  assert.equal(open.left + open.width, 100);
  assert.equal(stub.left, 75);
  assert.equal(stub.width, 5);
  assert.ok(!stub.openEnded, "an undated end on a draft is a stub, not a fade");
});

test("stripBars: a very short event still gets a visible bar inside the strip", () => {
  const w = { from: NOW, to: NOW + 100 * DAY };
  const b = stripBars([ev({ id: 1, starts_at: NOW + 100 * DAY - 60, ends_at: NOW + 100 * DAY })], w, NOW)[0]!;
  assert.ok(b.width >= 1.2);
  assert.ok(b.left + b.width <= 100 + 1e-9);
});

test("pickStripRows: keeps live and upcoming over old past events, in date order", () => {
  const w = { from: NOW - 10 * DAY, to: NOW + 10 * DAY };
  const events = [
    ev({ id: 1, status: "past", starts_at: NOW - 9 * DAY, ends_at: NOW - 8 * DAY }),
    ev({ id: 2, status: "past", starts_at: NOW - 7 * DAY, ends_at: NOW - 6 * DAY }),
    ev({ id: 3, status: "past", starts_at: NOW - 5 * DAY, ends_at: NOW - 4 * DAY }),
    ev({ id: 4, starts_at: NOW - DAY, ends_at: NOW + DAY }),
    ev({ id: 5, status: "draft", starts_at: NOW + 3 * DAY, ends_at: NOW + 4 * DAY }),
  ];
  const { rows, hidden } = pickStripRows(stripBars(events, w, NOW), 3);
  assert.equal(hidden, 2);
  assert.deepEqual(rows.map((b) => b.event.id), [3, 4, 5]);
  assert.equal(pickStripRows(stripBars(events, w, NOW), 10).hidden, 0);
});

test("stripPos clamps; stripTicks steps a week from the first midnight", () => {
  const w = { from: NOW, to: NOW + 30 * DAY };
  assert.equal(stripPos(NOW - DAY, w), 0);
  assert.equal(stripPos(NOW + 15 * DAY, w), 50);
  assert.equal(stripPos(NOW + 99 * DAY, w), 100);
  const ticks = stripTicks(w, utcMidnight);
  const first = ticks[0]!;
  assert.ok(first >= w.from && first - w.from < DAY);
  assert.equal(first % DAY, 0);
  assert.equal(ticks.length, 5);
  assert.ok(ticks.every((t, i) => i === 0 || t - ticks[i - 1]! === 7 * DAY));
});

test("groupByMonth: consecutive runs share a heading; order kept", () => {
  const sep = Date.UTC(2026, 8, 20) / 1000;
  const aug = Date.UTC(2026, 7, 3) / 1000;
  const g = groupByMonth(
    [ev({ id: 1, ends_at: sep }), ev({ id: 2, ends_at: sep - DAY }), ev({ id: 3, ends_at: aug }), ev({ id: 4, ends_at: null })],
    (e) => e.ends_at,
  );
  assert.deepEqual(
    g.map((x) => [x.label, x.events.map((e) => e.id)]),
    [
      ["September 2026", [1, 2]],
      ["August 2026", [3]],
      ["Date unknown", [4]],
    ],
  );
});

// ── View choice ─────────────────────────────────────────────────────────────

test("resolveEventsView: param beats cookie beats the timeline default", () => {
  assert.equal(resolveEventsView(undefined, undefined), "timeline");
  assert.equal(resolveEventsView(undefined, "list"), "list");
  assert.equal(resolveEventsView("timeline", "list"), "timeline");
  assert.equal(resolveEventsView(["list", "timeline"], undefined), "list");
  assert.equal(resolveEventsView("grid", "nonsense"), "timeline");
});
