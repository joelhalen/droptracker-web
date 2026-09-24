/**
 * Pure shaping for the /events timeline view: which events go in which band,
 * where each bar sits on the date strip, how far a live event has run. No
 * React, no clock reads: every function takes `nowSec` so the server render
 * and the tests agree on one instant.
 *
 * Times are unix seconds throughout, like EventSummary.
 */
import type { EventSummary } from "@droptracker/api-types";
import { COMPETITION_KIND_LABELS } from "@/lib/competition";
import { sortEventsChronologically } from "@/lib/events";

const DAY = 86_400;

/** Events split into the timeline's bands, each already in reading order. */
export type TimelineBands = {
  /** Running now, soonest end first. */
  live: EventSummary[];
  /** Upcoming with a start date, soonest first. */
  upcoming: EventSummary[];
  /** Upcoming with no start date yet (these never start on their own). */
  undated: EventSummary[];
  /** Ended, most recent first. */
  past: EventSummary[];
};

/** Merge the page's several lists (your events, upcoming, active, past) into
 * one, first copy of each id wins, then band them. */
export function buildTimelineBands(...lists: EventSummary[][]): TimelineBands {
  const seen = new Set<number>();
  const all: EventSummary[] = [];
  for (const list of lists) {
    for (const e of list) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      all.push(e);
    }
  }
  const sorted = sortEventsChronologically(all);
  return {
    live: sorted.filter((e) => e.status === "active"),
    upcoming: sorted.filter((e) => e.status === "draft" && e.starts_at != null),
    undated: sorted.filter((e) => e.status === "draft" && e.starts_at == null),
    past: sorted.filter((e) => e.status === "past"),
  };
}

export function timelineIsEmpty(b: TimelineBands): boolean {
  return !b.live.length && !b.upcoming.length && !b.undated.length && !b.past.length;
}

/** Short type label for a timeline card chip. */
export function eventTypeLabel(e: Pick<EventSummary, "kind" | "has_bingo">): string {
  switch (e.kind) {
    case "sotw":
    case "botw":
      return COMPETITION_KIND_LABELS[e.kind];
    case "board_game":
      return "Board game";
    case "conquest":
      return "Conquest";
    case "loot_sweep":
      return "Loot Sweep";
    case "bingo":
      return "Bingo";
    default:
      return e.has_bingo ? "Bingo" : "Task race";
  }
}

/** How far through its window a live event is, 0..1. Null when the window is
 * open-ended or not a real range. */
export function liveProgress(
  e: Pick<EventSummary, "starts_at" | "ends_at" | "activated_at">,
  nowSec: number,
): number | null {
  const start = e.starts_at ?? e.activated_at ?? null;
  const end = e.ends_at;
  if (start == null || end == null || end <= start) return null;
  return Math.min(1, Math.max(0, (nowSec - start) / (end - start)));
}

/** "Day 3 of 7" for a live event, counting the first day as day 1. Null for
 * open-ended events and ones shorter than two days (where it says nothing). */
export function liveDayLabel(
  e: Pick<EventSummary, "starts_at" | "ends_at" | "activated_at">,
  nowSec: number,
): string | null {
  const start = e.starts_at ?? e.activated_at ?? null;
  const end = e.ends_at;
  if (start == null || end == null || end - start < 2 * DAY) return null;
  const total = Math.ceil((end - start) / DAY);
  const day = Math.min(total, Math.max(1, Math.floor((nowSec - start) / DAY) + 1));
  return `Day ${day} of ${total}`;
}

// ── Date strip ───────────────────────────────────────────────────────────────

/** The strip's visible range. */
export type StripWindow = { from: number; to: number };

/** Baseline: two weeks either side of now. Stretched (within limits) so a
 * long-running live event shows where it began and a far-off event still
 * lands on the strip; a quiet page keeps a short, un-empty axis. */
const BACK = 14 * DAY;
const AHEAD = 14 * DAY;
const MAX_BACK = 60 * DAY;
const MAX_AHEAD = 120 * DAY;

export function stripWindow(events: EventSummary[], nowSec: number): StripWindow {
  let from = nowSec - BACK;
  let to = nowSec + AHEAD;
  for (const e of events) {
    if (e.status === "active" && e.starts_at != null) from = Math.min(from, e.starts_at - DAY);
    if (e.status === "draft" && e.starts_at != null) {
      to = Math.max(to, Math.max(e.starts_at, e.ends_at ?? e.starts_at) + DAY);
    }
    if (e.status === "active" && e.ends_at != null) to = Math.max(to, e.ends_at + DAY);
  }
  return {
    from: Math.max(from, nowSec - MAX_BACK),
    to: Math.min(to, nowSec + MAX_AHEAD),
  };
}

/** One bar on the strip, in percent of the strip's width. */
export type StripBar = {
  event: EventSummary;
  left: number;
  width: number;
  /** The event runs past the strip's edge on that side. */
  clippedStart: boolean;
  clippedEnd: boolean;
  /** No end date: drawn to the strip's edge and faded out. */
  openEnded: boolean;
};

/** Narrowest a bar is drawn, so a one-hour event is still a visible target. */
const MIN_BAR_PCT = 1.2;

/** Bars for every event that touches the window, in start order. An
 * upcoming event with a start but no end gets a one-day stub; one with no
 * start at all can't be placed and is left to the list below the strip. */
export function stripBars(events: EventSummary[], w: StripWindow, nowSec: number): StripBar[] {
  const span = w.to - w.from;
  if (span <= 0) return [];
  const bars: StripBar[] = [];
  for (const e of events) {
    const start = e.starts_at ?? e.activated_at ?? null;
    if (start == null) continue;
    let end = e.ends_at ?? e.ended_at ?? null;
    const openEnded = end == null;
    if (end == null) end = e.status === "draft" ? start + DAY : Math.max(w.to, nowSec);
    if (end <= w.from || start >= w.to) continue;
    const a = Math.max(start, w.from);
    const b = Math.min(end, w.to);
    const left = ((a - w.from) / span) * 100;
    const width = Math.max(MIN_BAR_PCT, ((b - a) / span) * 100);
    bars.push({
      event: e,
      left: Math.min(left, 100 - MIN_BAR_PCT),
      width: Math.min(width, 100 - Math.min(left, 100 - MIN_BAR_PCT)),
      clippedStart: start < w.from,
      clippedEnd: end > w.to && !openEnded,
      openEnded: openEnded && e.status !== "draft",
    });
  }
  return bars.sort((x, y) => x.left - y.left || y.event.id - x.event.id);
}

const ROW_PRIORITY: Record<EventSummary["status"], number> = { active: 0, draft: 1, past: 2 };

/** At most `max` bars, choosing what matters most (live, then coming up, then
 * the most recently ended) but drawn in date order. Returns the chosen bars
 * and how many were left out. */
export function pickStripRows(bars: StripBar[], max: number): { rows: StripBar[]; hidden: number } {
  if (bars.length <= max) return { rows: bars, hidden: 0 };
  const chosen = [...bars]
    .sort(
      (x, y) =>
        ROW_PRIORITY[x.event.status] - ROW_PRIORITY[y.event.status] ||
        // past: most recent first; otherwise soonest first
        (x.event.status === "past" ? y.left + y.width - (x.left + x.width) : x.left - y.left),
    )
    .slice(0, max);
  const keep = new Set(chosen.map((b) => b.event.id));
  return { rows: bars.filter((b) => keep.has(b.event.id)), hidden: bars.length - max };
}

/** Percent position of an instant on the strip (clamped to 0..100). */
export function stripPos(t: number, w: StripWindow): number {
  const span = w.to - w.from;
  if (span <= 0) return 0;
  return Math.min(100, Math.max(0, ((t - w.from) / span) * 100));
}

/** Tick instants every `stepDays` from the first local midnight at or after
 * `w.from`. `midnightOf` maps an instant to its local-midnight instant; it's
 * injected so tests (and the server) can use UTC. */
export function stripTicks(
  w: StripWindow,
  midnightOf: (t: number) => number,
  stepDays = 7,
): number[] {
  const ticks: number[] = [];
  let t = midnightOf(w.from);
  if (t < w.from) t = midnightOf(t + DAY + 3600);
  // Step by calendar days via midnightOf so DST shifts don't drift the ticks.
  while (t < w.to && ticks.length < 40) {
    ticks.push(t);
    let next = t;
    for (let i = 0; i < stepDays; i++) next = midnightOf(next + DAY + 3600);
    t = next;
  }
  return ticks;
}

/** Local midnight (browser timezone) of the instant `t`. */
export function localMidnight(t: number): number {
  const d = new Date(t * 1000);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

/** Group already-sorted past events under "September 2026" style headings
 * (UTC, since the server renders them). Order is preserved. */
export function groupByMonth(
  events: EventSummary[],
  at: (e: EventSummary) => number | null | undefined,
): { label: string; events: EventSummary[] }[] {
  const fmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const groups: { label: string; events: EventSummary[] }[] = [];
  for (const e of events) {
    const t = at(e);
    const label = t != null ? fmt.format(new Date(t * 1000)) : "Date unknown";
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.events.push(e);
    else groups.push({ label, events: [e] });
  }
  return groups;
}

// ── View choice ──────────────────────────────────────────────────────────────

export type EventsView = "timeline" | "list";
/** Remembers the viewer's /events view (set by EventsViewSwitch). */
export const EVENTS_VIEW_COOKIE = "dt_events_view";

/** `?view=` wins (links and cookie-less browsers), then the cookie, then the
 * timeline, which is the default. Anything unrecognised is ignored. */
export function resolveEventsView(
  param: string | string[] | undefined,
  cookie: string | undefined,
): EventsView {
  const p = Array.isArray(param) ? param[0] : param;
  for (const v of [p, cookie]) {
    if (v === "timeline" || v === "list") return v;
  }
  return "timeline";
}
