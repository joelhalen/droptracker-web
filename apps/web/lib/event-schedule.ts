/**
 * Recurring event schedules (web82a) — the client-side mirror of the
 * backend's `services/event_schedule.py`.
 *
 * The backend is the authority: it compiles a rule into the `web_event_windows`
 * rows every consumer scores against. This module exists so the schedule
 * builder can show an organizer exactly which windows their rule produces
 * *while they type*, instead of a round trip per keystroke. Keep the two in
 * step — the materialization below is a deliberate line-for-line port,
 * including the clamp/merge order and the error sentences.
 *
 * Everything here is UTC. Rules are authored against the UTC clock (OSRS game
 * time) so international clans and DST never make a window ambiguous; UTC
 * midnights are exactly `86400`s apart, so plain unix-second arithmetic is
 * safe and no `Date` maths is needed except to name a calendar month.
 *
 * `dow` is 0 = Monday … 6 = Sunday (Python `weekday()` numbering), NOT JS
 * `getDay()`.
 */
import {
  EVENT_SCHEDULE_LIMITS,
  type EventScheduleMonthOrdinal,
  type EventScheduleRule,
  type EventScheduleWindow,
} from "@droptracker/api-types";

const DAY = 86_400;

/** Weekday labels indexed by the backend's 0 = Monday numbering. */
export const DOW_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const DOW_LONG_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function dowName(dow: number): string {
  return DOW_NAMES[dow] ?? "?";
}

/** UTC midnight of the day `unix` falls in. */
function dayStart(unix: number): number {
  return Math.floor(unix / DAY) * DAY;
}

/** Weekday of a unix instant, 0 = Monday (the unix epoch was a Thursday). */
function dowOf(unix: number): number {
  return (Math.floor(unix / DAY) + 3) % 7;
}

/** "HH:MM" → seconds past midnight (0 when malformed — the API revalidates). */
function clockSeconds(hhmm: string): number {
  const [h, m] = String(hhmm ?? "").split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 3600 + mm * 60;
}

/** Seconds past midnight → "HH:MM". */
export function formatClock(seconds: number): string {
  const s = ((seconds % DAY) + DAY) % DAY;
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Sort + merge overlapping/adjacent windows into a disjoint ordered list. */
function merge(windows: EventScheduleWindow[]): EventScheduleWindow[] {
  const out: EventScheduleWindow[] = [];
  for (const w of [...windows].sort((a, b) => a.starts_at - b.starts_at || a.ends_at - b.ends_at)) {
    const last = out[out.length - 1];
    if (last && w.starts_at <= last.ends_at) {
      if (w.ends_at > last.ends_at) last.ends_at = w.ends_at;
      continue;
    }
    out.push({ ...w });
  }
  return out;
}

/** Every occurrence of one weekly day/time spec from `genStart`'s week up to
 * `spanEnd` — unclamped; the caller filters (cadence) and clamps. */
function weeklyCandidates(
  spec: { start_dow: number; start_time: string; end_dow: number; end_time: string },
  genStart: number,
  spanEnd: number,
): EventScheduleWindow[] {
  const startSecs = clockSeconds(spec.start_time);
  const endSecs = clockSeconds(spec.end_time);
  const daysOff = (((spec.end_dow - spec.start_dow) % 7) + 7) % 7;
  let day = dayStart(genStart - 7 * DAY);
  day += ((((spec.start_dow - dowOf(day)) % 7) + 7) % 7) * DAY;

  const out: EventScheduleWindow[] = [];
  // The generator is bounded by spanEnd, but a malformed span must not spin.
  for (let guard = 0; guard <= EVENT_SCHEDULE_LIMITS.materializedWindows * 4; guard += 1) {
    const start = day + startSecs;
    let end = day + daysOff * DAY + endSecs;
    while (end <= start) end += DAY;
    if (start > spanEnd) return out;
    out.push({ starts_at: start, ends_at: end });
    day += 7 * DAY;
  }
  throw new ScheduleTooBig("The schedule produces too many windows.");
}

class ScheduleTooBig extends Error {}

/** The calendar month an instant falls in, as a groupable key. */
function monthKey(unix: number): string {
  const d = new Date(unix * 1000);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

export type MaterializeResult = {
  /** Disjoint, ordered scoring windows inside [startsAt, endsAt]. */
  windows: EventScheduleWindow[];
  /** A user-facing sentence when the rule can't produce a usable list — the
   * same complaint the API would answer with (422 "Invalid schedule"). */
  error: string | null;
};

/**
 * Compile a rule into the scoring windows it produces inside the event's
 * overall span. Mirrors `event_schedule.materialize()`; returns the error as a
 * value rather than throwing, because it is rendered inline under a form.
 */
export function materializeSchedule(
  rule: EventScheduleRule | null | undefined,
  startsAt: number | null | undefined,
  endsAt: number | null | undefined,
): MaterializeResult {
  if (!rule) return { windows: [], error: null };
  if (startsAt == null || endsAt == null) {
    return { windows: [], error: "A recurring schedule needs both a start and an end date." };
  }
  if (endsAt <= startsAt) {
    return { windows: [], error: "The event ends before it starts." };
  }

  const raw: EventScheduleWindow[] = [];
  try {
    if (rule.type === "weekly") {
      const ordinal = rule.month_ordinal ?? null;
      const interval = rule.interval_weeks || 1;
      // With a month ordinal the WHOLE month's occurrences have to be visible
      // to know which one is "first"/"last", so generation starts at the 1st
      // of the start month (anything before starts_at simply clamps away).
      const genStart = ordinal ? startOfUtcMonth(startsAt) : startsAt;
      for (const spec of rule.windows) {
        let occs = weeklyCandidates(spec, genStart, endsAt);
        if (ordinal) {
          occs = pickMonthOrdinal(occs, ordinal);
        } else if (interval > 1) {
          // Anchored on the first occurrence that touches the event span.
          const anchored = occs.filter((o) => o.ends_at > startsAt);
          const anchorDay = anchored.length ? dayStart(anchored[0]!.starts_at) : 0;
          occs = anchored.filter(
            (o) => Math.floor((dayStart(o.starts_at) - anchorDay) / DAY / 7) % interval === 0,
          );
        }
        raw.push(...occs);
      }
    } else if (rule.type === "daily") {
      const startSecs = clockSeconds(rule.start_time);
      const endSecs = clockSeconds(rule.end_time);
      const last = dayStart(endsAt);
      for (let day = dayStart(startsAt - DAY); day <= last; day += DAY) {
        const start = day + startSecs;
        let end = day + endSecs;
        if (end <= start) end += DAY; // crosses midnight
        raw.push({ starts_at: start, ends_at: end });
      }
    } else {
      for (const w of rule.windows) {
        raw.push({ starts_at: w.start, ends_at: w.end });
      }
    }
  } catch (err) {
    if (err instanceof ScheduleTooBig) return { windows: [], error: err.message };
    throw err;
  }

  const clamped: EventScheduleWindow[] = [];
  for (const w of raw) {
    const start = Math.max(w.starts_at, startsAt);
    const end = Math.min(w.ends_at, endsAt);
    if (end > start) clamped.push({ starts_at: start, ends_at: end });
  }
  const windows = merge(clamped);
  if (!windows.length) {
    return {
      windows: [],
      error:
        "This schedule never opens between the event's start and end dates — adjust the dates or the schedule.",
    };
  }
  if (windows.length > EVENT_SCHEDULE_LIMITS.materializedWindows) {
    return {
      windows,
      error: `This schedule produces ${windows.length} scoring windows (the limit is ${EVENT_SCHEDULE_LIMITS.materializedWindows}) — simplify it or shorten the event.`,
    };
  }
  return { windows, error: null };
}

/** UTC midnight on the 1st of the month `unix` falls in. */
function startOfUtcMonth(unix: number): number {
  const d = new Date(unix * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000);
}

/** Keep only the Nth occurrence of each calendar month (-1 = the last one). */
function pickMonthOrdinal(
  occs: EventScheduleWindow[],
  ordinal: EventScheduleMonthOrdinal,
): EventScheduleWindow[] {
  const byMonth = new Map<string, EventScheduleWindow[]>();
  for (const occ of occs) {
    const key = monthKey(occ.starts_at);
    const bucket = byMonth.get(key);
    if (bucket) bucket.push(occ);
    else byMonth.set(key, [occ]);
  }
  const out: EventScheduleWindow[] = [];
  for (const bucket of byMonth.values()) {
    const idx = ordinal > 0 ? ordinal - 1 : bucket.length + ordinal;
    const pick = bucket[idx];
    if (pick) out.push(pick);
  }
  return out.sort((a, b) => a.starts_at - b.starts_at);
}

/** Where a materialized schedule stands right now: whether scoring is open,
 * the window that's running, and the next one to open. Derived client-side so
 * a cached page's `scoring_open` can't go stale in the viewer's browser. */
export function scheduleStatusAt(
  windows: EventScheduleWindow[] | null | undefined,
  nowSec: number,
): { open: boolean; current: EventScheduleWindow | null; next: EventScheduleWindow | null } {
  const current = (windows ?? []).find((w) => w.starts_at <= nowSec && nowSec < w.ends_at) ?? null;
  const next = (windows ?? []).find((w) => w.starts_at > nowSec) ?? null;
  return { open: current != null, current, next };
}

const ORDINAL_LABELS: Record<number, string> = {
  1: "first",
  2: "second",
  3: "third",
  4: "fourth",
  [-1]: "last",
};

/**
 * One human-readable line for a rule — the same sentence the backend's
 * `describe()` stores on `schedule_summary`, so an unsaved edit previews the
 * wording the event page will end up showing.
 */
export function describeSchedule(rule: EventScheduleRule | null | undefined): string | null {
  if (!rule) return null;
  if (rule.type === "weekly") {
    const spans = rule.windows
      .map(
        (s) =>
          `${dowName(s.start_dow)} ${s.start_time} → ${dowName(s.end_dow)} ${s.end_time}`,
      )
      .join(", ");
    const ordinal = rule.month_ordinal ?? null;
    const interval = rule.interval_weeks || 1;
    let cadence = "";
    if (ordinal != null && ORDINAL_LABELS[ordinal]) {
      cadence = `, the ${ORDINAL_LABELS[ordinal]} occurrence each month`;
    } else if (interval === 2) {
      cadence = ", every other week";
    } else if (interval > 2) {
      cadence = `, every ${interval} weeks`;
    }
    return `Weekly: ${spans} UTC${cadence}`;
  }
  if (rule.type === "daily") {
    return `Daily: ${rule.start_time} → ${rule.end_time} UTC`;
  }
  const n = rule.windows.length;
  return `${n} custom scoring window${n === 1 ? "" : "s"}`;
}

/* --- Presets --------------------------------------------------------------
 * The rules clans actually ask for, one click each. "Custom…" carries no rule
 * — it just drops the builder into the advanced editor with whatever is there.
 */
export type SchedulePresetKey =
  | "weekends"
  | "alternate_weekends"
  | "first_weekend"
  | "weekly_evening"
  | "prime_time"
  | "custom";

export type SchedulePreset = {
  key: SchedulePresetKey;
  label: string;
  blurb: string;
  /** null ⇒ "Custom…": keep the current rule and open the advanced editor. */
  rule: EventScheduleRule | null;
};

/** Sat 00:00 → Mon 00:00 UTC: the whole weekend as one window. */
const WEEKEND_WINDOW = { start_dow: 5, start_time: "00:00", end_dow: 0, end_time: "00:00" };

export const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    key: "weekends",
    label: "Weekends",
    blurb: "Sat 00:00 → Mon 00:00, every week",
    rule: { type: "weekly", windows: [WEEKEND_WINDOW], interval_weeks: 1, month_ordinal: null },
  },
  {
    key: "alternate_weekends",
    label: "Every other weekend",
    blurb: "The same window, one weekend on, one off",
    rule: { type: "weekly", windows: [WEEKEND_WINDOW], interval_weeks: 2, month_ordinal: null },
  },
  {
    key: "first_weekend",
    label: "First weekend of each month",
    blurb: "One weekend a month, the first one",
    rule: { type: "weekly", windows: [WEEKEND_WINDOW], interval_weeks: 1, month_ordinal: 1 },
  },
  {
    key: "weekly_evening",
    label: "One evening a week",
    blurb: "18:00 → 23:59 on a day you pick",
    rule: {
      type: "weekly",
      windows: [{ start_dow: 2, start_time: "18:00", end_dow: 2, end_time: "23:59" }],
      interval_weeks: 1,
      month_ordinal: null,
    },
  },
  {
    key: "prime_time",
    label: "Prime time daily",
    blurb: "19:00 → 23:00, every day",
    rule: { type: "daily", start_time: "19:00", end_time: "23:00" },
  },
  {
    key: "custom",
    label: "Custom…",
    blurb: "Build the windows by hand",
    rule: null,
  },
];

/** Stable serialization of a rule — used to highlight the preset a rule came
 * from (field order varies with how the object was built). */
function ruleKey(rule: EventScheduleRule): string {
  if (rule.type === "weekly") {
    const windows = rule.windows
      .map((w) => `${w.start_dow}@${w.start_time}>${w.end_dow}@${w.end_time}`)
      .join("|");
    return `weekly:${windows}:i${rule.interval_weeks || 1}:o${rule.month_ordinal ?? 0}`;
  }
  if (rule.type === "daily") return `daily:${rule.start_time}>${rule.end_time}`;
  return `custom:${rule.windows.map((w) => `${w.start}-${w.end}`).join("|")}`;
}

/** Which preset (if any) a rule is exactly. */
export function matchPreset(rule: EventScheduleRule | null | undefined): SchedulePresetKey | null {
  if (!rule) return null;
  const key = ruleKey(rule);
  return SCHEDULE_PRESETS.find((p) => p.rule && ruleKey(p.rule) === key)?.key ?? null;
}

/** A blank rule of each type, for switching the advanced editor's rule kind. */
export function emptyRule(type: EventScheduleRule["type"]): EventScheduleRule {
  if (type === "daily") return { type: "daily", start_time: "19:00", end_time: "23:00" };
  if (type === "custom") return { type: "custom", windows: [] };
  return { type: "weekly", windows: [WEEKEND_WINDOW], interval_weeks: 1, month_ordinal: null };
}

/** Total scoring time a window list covers, in seconds. */
export function totalWindowSeconds(windows: EventScheduleWindow[]): number {
  return windows.reduce((sum, w) => sum + (w.ends_at - w.starts_at), 0);
}
