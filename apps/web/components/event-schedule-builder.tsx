"use client";

/**
 * Recurring activation schedule editor (web82a) — shared by the setup wizard's
 * Schedule step and the manager's settings form.
 *
 * An event normally runs as one unbroken window between its start and end
 * dates. A schedule narrows that to repeating windows ("every weekend, for a
 * month") without splitting the event: it stays one event, points keep adding
 * up and there is one winner at the end. Between windows the event is still
 * live — only scoring pauses.
 *
 * Two decisions, in this order:
 *  1. Continuous (the default, and what every event did before this) or
 *     scheduled — nobody has to learn a rule builder to run a normal event.
 *  2. If scheduled: a one-click preset covering the rules clans actually ask
 *     for, with the advanced editor behind a disclosure for everything else.
 *
 * The rule is authored in **UTC** (OSRS game time) on purpose — one clock for
 * an international roster, and no DST cliff mid-event. Every UTC value here is
 * therefore shown with its local equivalent, and the preview lists the windows
 * in the viewer's own timezone.
 *
 * The preview is computed client-side by `lib/event-schedule` (a port of the
 * backend's materializer) — the backend still has the final say when the form
 * is saved, but an organizer must not have to save to find out what their rule
 * does.
 */
import { useMemo, useRef, useState } from "react";
import {
  EVENT_SCHEDULE_LIMITS,
  type EventKind,
  type EventScheduleInput,
  type EventScheduleRule,
} from "@droptracker/api-types";
import {
  DOW_LONG_NAMES,
  SCHEDULE_PRESETS,
  describeSchedule,
  emptyRule,
  materializeSchedule,
  matchPreset,
  totalWindowSeconds,
} from "@/lib/event-schedule";
import { LocalTime, UtcClockNote } from "@/components/local-time";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-2 py-1.5 text-sm outline-none";
const smallBtn =
  "border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-2 py-1 text-xs disabled:opacity-40";

/** How many of the produced windows the preview lists before scrolling. */
const PREVIEW_ROWS = 8;

/** Unix seconds → a datetime-local input value in the viewer's timezone. */
function toLocalInput(unix: number | null | undefined): string {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

const toUnix = (v: string): number | null => (v ? Math.floor(new Date(v).getTime() / 1000) : null);

/** "4d 8h" — how much scoring time a window list actually adds up to. */
function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.round((seconds % 86_400) / 3600);
  if (days && hours) return `${days}d ${hours}h`;
  if (days) return `${days}d`;
  return `${hours}h`;
}

/** Cadence select values: every Nth week, or the Nth occurrence of a month. */
const CADENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "every-1", label: "Every week" },
  { value: "every-2", label: "Every other week" },
  { value: "every-3", label: "Every 3 weeks" },
  { value: "every-4", label: "Every 4 weeks" },
  { value: "ordinal-1", label: "First one each month" },
  { value: "ordinal-2", label: "Second one each month" },
  { value: "ordinal-3", label: "Third one each month" },
  { value: "ordinal-4", label: "Fourth one each month" },
  { value: "ordinal--1", label: "Last one each month" },
];

function cadenceValue(rule: Extract<EventScheduleRule, { type: "weekly" }>): string {
  if (rule.month_ordinal != null) return `ordinal-${rule.month_ordinal}`;
  return `every-${rule.interval_weeks || 1}`;
}

export function EventScheduleBuilder({
  value,
  onChange,
  startsAt,
  endsAt,
  kind,
  status,
  className = "",
}: {
  /** null ⇒ a continuous event (no schedule sent). */
  value: EventScheduleInput | null;
  onChange: (next: EventScheduleInput | null) => void;
  /** The event's overall span (unix seconds) — the preview clamps to it. */
  startsAt: number | null;
  endsAt: number | null;
  kind: EventKind;
  /** Drives the live-event warning; omit on the create path. */
  status?: "draft" | "active" | "past";
  className?: string;
}) {
  const rule = value?.rule ?? null;
  // Remembers the rule while "Runs continuously" is selected, so toggling back
  // doesn't wipe a schedule the organizer just built.
  const lastRule = useRef<EventScheduleRule | null>(rule);
  if (rule) lastRule.current = rule;
  const [advanced, setAdvanced] = useState(() => rule != null && matchPreset(rule) == null);

  const setRule = (next: EventScheduleRule | null) =>
    onChange(next ? { tz: "UTC", rule: next } : null);

  const preview = useMemo(
    () => materializeSchedule(rule, startsAt, endsAt),
    [rule, startsAt, endsAt],
  );
  const presetKey = matchPreset(rule);

  // Board-game clocks (turn cooldowns, auto-stall, shop restocks) are
  // wall-clock and keep ticking while scoring is closed, so the backend
  // refuses a schedule outright. Say so rather than failing on save.
  if (kind === "board_game") {
    return (
      <p className={`text-osrs-parchment-dark/50 text-xs ${className}`}>
        Board-game events run continuously — their turn timers keep ticking between rounds, so they
        can&apos;t score in repeating windows.
      </p>
    );
  }

  return (
    <fieldset className={`border-osrs-bronze/20 space-y-3 rounded border p-3 ${className}`}>
      <legend className="text-osrs-gold px-1 text-sm font-semibold">How often does it run?</legend>

      <div className="space-y-2" role="radiogroup">
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="radio"
            name="event-schedule-mode"
            checked={rule == null}
            onChange={() => setRule(null)}
            className="mt-0.5"
          />
          <span className="min-w-0">
            Runs continuously
            <span className="text-osrs-parchment-dark/50 block text-xs">
              One unbroken window: everything submitted between the start and end dates counts.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="radio"
            name="event-schedule-mode"
            checked={rule != null}
            onChange={() => setRule(lastRule.current ?? emptyRule("weekly"))}
            className="mt-0.5"
          />
          <span className="min-w-0">
            Repeats on a schedule
            <span className="text-osrs-parchment-dark/50 block text-xs">
              Still one event with one winner — scoring just opens and closes on a repeating
              pattern. Between windows the event stays live but submissions don&apos;t count.
            </span>
          </span>
        </label>
      </div>

      {rule && (
        <div className="space-y-3">
          {/* Presets first: these cover the rules clans actually ask for. */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SCHEDULE_PRESETS.map((preset) => {
              const selected = preset.rule ? presetKey === preset.key : advanced && !presetKey;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => {
                    if (preset.rule) {
                      setRule(preset.rule);
                      // "One evening a week" needs a day picked; the others are
                      // complete as-is, so only that one forces the editor open.
                      setAdvanced(preset.key === "weekly_evening");
                    } else {
                      setAdvanced(true);
                    }
                  }}
                  className={`min-w-0 rounded border p-2 text-left ${
                    selected
                      ? "border-osrs-gold bg-osrs-brown-dark/60"
                      : "border-osrs-bronze/30 bg-osrs-brown-dark/30 hover:border-osrs-gold/70"
                  }`}
                >
                  <span className="text-osrs-parchment block truncate text-sm font-medium">
                    {preset.label}
                  </span>
                  <span className="text-osrs-parchment-dark/60 block text-xs">{preset.blurb}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setAdvanced((a) => !a)}
            className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-xs"
          >
            {advanced ? "▾ Hide the details" : "▸ Fine-tune the windows"}
          </button>

          {advanced && <AdvancedEditor rule={rule} onRule={setRule} />}

          <SchedulePreview preview={preview} rule={rule} />

          {status === "active" && (
            <p className="border-osrs-gold/30 bg-osrs-gold/10 text-osrs-parchment-dark/90 rounded border px-2 py-1.5 text-xs">
              This event is live. Windows that have already finished are kept exactly as they were —
              credit earned in them stays valid — but every window from now on is rebuilt from the
              new rule.
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}

/** Rule-type picker plus the editor for the chosen type. */
function AdvancedEditor({
  rule,
  onRule,
}: {
  rule: EventScheduleRule;
  onRule: (next: EventScheduleRule) => void;
}) {
  return (
    <div className="border-osrs-bronze/20 space-y-3 rounded border border-dashed p-2.5">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["weekly", "Weekly"],
            ["daily", "Daily"],
            ["custom", "Specific dates"],
          ] as const
        ).map(([type, label]) => (
          <button
            key={type}
            type="button"
            onClick={() => rule.type !== type && onRule(emptyRule(type))}
            className={`rounded border px-2 py-1 text-xs ${
              rule.type === type
                ? "border-osrs-gold text-osrs-gold"
                : "border-osrs-bronze/30 text-osrs-parchment-dark/70 hover:border-osrs-gold/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {rule.type === "weekly" && <WeeklyEditor rule={rule} onRule={onRule} />}
      {rule.type === "daily" && <DailyEditor rule={rule} onRule={onRule} />}
      {rule.type === "custom" && <CustomEditor rule={rule} onRule={onRule} />}
    </div>
  );
}

function WeeklyEditor({
  rule,
  onRule,
}: {
  rule: Extract<EventScheduleRule, { type: "weekly" }>;
  onRule: (next: EventScheduleRule) => void;
}) {
  const patchWindow = (idx: number, patch: Partial<(typeof rule.windows)[number]>) =>
    onRule({
      ...rule,
      windows: rule.windows.map((w, i) => (i === idx ? { ...w, ...patch } : w)),
    });

  return (
    <div className="space-y-2">
      {rule.windows.map((w, idx) => (
        <div key={idx} className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-xs">
            <span className="text-osrs-parchment-dark/60 mb-0.5 block">Opens</span>
            <span className="flex min-w-0 gap-1">
              <select
                value={w.start_dow}
                onChange={(e) => patchWindow(idx, { start_dow: Number(e.target.value) })}
                className={`${field} min-w-0 flex-1`}
              >
                {DOW_LONG_NAMES.map((name, dow) => (
                  <option key={dow} value={dow}>
                    {name}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={w.start_time}
                onChange={(e) => patchWindow(idx, { start_time: e.target.value || "00:00" })}
                className={`${field} min-w-0`}
              />
            </span>
          </label>
          <span className="text-osrs-parchment-dark/50 pb-2 text-xs">→</span>
          <label className="min-w-0 flex-1 text-xs">
            <span className="text-osrs-parchment-dark/60 mb-0.5 block">Closes</span>
            <span className="flex min-w-0 gap-1">
              <select
                value={w.end_dow}
                onChange={(e) => patchWindow(idx, { end_dow: Number(e.target.value) })}
                className={`${field} min-w-0 flex-1`}
              >
                {DOW_LONG_NAMES.map((name, dow) => (
                  <option key={dow} value={dow}>
                    {name}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={w.end_time}
                onChange={(e) => patchWindow(idx, { end_time: e.target.value || "00:00" })}
                className={`${field} min-w-0`}
              />
            </span>
          </label>
          {rule.windows.length > 1 && (
            <button
              type="button"
              onClick={() => onRule({ ...rule, windows: rule.windows.filter((_, i) => i !== idx) })}
              className={smallBtn}
              aria-label="Remove this weekly window"
            >
              Remove
            </button>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-end justify-between gap-2">
        <button
          type="button"
          disabled={rule.windows.length >= EVENT_SCHEDULE_LIMITS.weeklyWindows}
          onClick={() =>
            onRule({
              ...rule,
              windows: [
                ...rule.windows,
                { start_dow: 2, start_time: "18:00", end_dow: 2, end_time: "23:59" },
              ],
            })
          }
          className={smallBtn}
        >
          + Add another window
        </button>
        <label className="min-w-0 text-xs">
          <span className="text-osrs-parchment-dark/60 mb-0.5 block">How often</span>
          <select
            value={cadenceValue(rule)}
            onChange={(e) => {
              const [mode, raw] = e.target.value.split(/-(?=-?\d+$)/);
              const n = Number(raw);
              onRule(
                mode === "ordinal"
                  ? { ...rule, interval_weeks: 1, month_ordinal: n as 1 | 2 | 3 | 4 | -1 }
                  : { ...rule, interval_weeks: n, month_ordinal: null },
              );
            }}
            className={`${field} min-w-0`}
          >
            {CADENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-osrs-parchment-dark/50 text-xs">
        Days and times are UTC. A window whose close is on the same day at (or before) its open —
        or on a later weekday — simply runs on into the following days.{" "}
        <UtcClockNote time={rule.windows[0]?.start_time ?? "00:00"} />
      </p>
    </div>
  );
}

function DailyEditor({
  rule,
  onRule,
}: {
  rule: Extract<EventScheduleRule, { type: "daily" }>;
  onRule: (next: EventScheduleRule) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 text-xs">
          <span className="text-osrs-parchment-dark/60 mb-0.5 block">Opens (UTC)</span>
          <input
            type="time"
            value={rule.start_time}
            onChange={(e) => onRule({ ...rule, start_time: e.target.value || "00:00" })}
            className={`${field} min-w-0`}
          />
        </label>
        <span className="text-osrs-parchment-dark/50 pb-2 text-xs">→</span>
        <label className="min-w-0 text-xs">
          <span className="text-osrs-parchment-dark/60 mb-0.5 block">Closes (UTC)</span>
          <input
            type="time"
            value={rule.end_time}
            onChange={(e) => onRule({ ...rule, end_time: e.target.value || "00:00" })}
            className={`${field} min-w-0`}
          />
        </label>
      </div>
      <p className="text-osrs-parchment-dark/50 text-xs">
        A close at or before the open runs past midnight into the next day.{" "}
        <UtcClockNote time={rule.start_time} />
      </p>
    </div>
  );
}

function CustomEditor({
  rule,
  onRule,
}: {
  rule: Extract<EventScheduleRule, { type: "custom" }>;
  onRule: (next: EventScheduleRule) => void;
}) {
  const patch = (idx: number, next: Partial<{ start: number; end: number }>) =>
    onRule({
      ...rule,
      windows: rule.windows.map((w, i) => (i === idx ? { ...w, ...next } : w)),
    });

  return (
    <div className="space-y-2">
      {rule.windows.length === 0 && (
        <p className="text-osrs-parchment-dark/50 text-xs">
          No windows yet — add the exact dates scoring should be open on.
        </p>
      )}
      {rule.windows.map((w, idx) => (
        <div key={idx} className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-xs">
            <span className="text-osrs-parchment-dark/60 mb-0.5 block">Opens</span>
            <input
              type="datetime-local"
              value={toLocalInput(w.start)}
              onChange={(e) => patch(idx, { start: toUnix(e.target.value) ?? w.start })}
              className={`${field} w-full min-w-0`}
            />
          </label>
          <label className="min-w-0 flex-1 text-xs">
            <span className="text-osrs-parchment-dark/60 mb-0.5 block">Closes</span>
            <input
              type="datetime-local"
              value={toLocalInput(w.end)}
              onChange={(e) => patch(idx, { end: toUnix(e.target.value) ?? w.end })}
              className={`${field} w-full min-w-0`}
            />
          </label>
          <button
            type="button"
            onClick={() => onRule({ ...rule, windows: rule.windows.filter((_, i) => i !== idx) })}
            className={smallBtn}
            aria-label="Remove this window"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={rule.windows.length >= EVENT_SCHEDULE_LIMITS.customWindows}
        onClick={() => {
          // Default the new row to the day after the last one ends, same
          // length — adding a run of weekly sessions is then just clicking.
          const last = rule.windows[rule.windows.length - 1];
          const start = last ? last.end + 86_400 : Math.floor(Date.now() / 1000) + 86_400;
          const length = last ? last.end - last.start : 86_400;
          onRule({ ...rule, windows: [...rule.windows, { start, end: start + length }] });
        }}
        className={smallBtn}
      >
        + Add a window
      </button>
      <p className="text-osrs-parchment-dark/50 text-xs">
        Entered in your own timezone (these are exact moments, not a repeating rule) and stored as
        UTC.
      </p>
    </div>
  );
}

/** What the rule actually produces inside the event's dates. */
function SchedulePreview({
  preview,
  rule,
}: {
  preview: ReturnType<typeof materializeSchedule>;
  rule: EventScheduleRule;
}) {
  const { windows, error } = preview;
  const summary = describeSchedule(rule);

  return (
    <div className="border-osrs-bronze/20 bg-osrs-brown-dark/20 space-y-2 rounded border p-2.5">
      <p className="text-osrs-parchment-dark/80 text-xs">
        <span className="text-osrs-gold font-medium">Preview</span>
        {summary && <span className="ml-1">· {summary}</span>}
      </p>
      {error ? (
        <p className="text-osrs-red text-xs">{error}</p>
      ) : windows.length === 0 ? (
        <p className="text-osrs-parchment-dark/50 text-xs">
          Set the event&apos;s start and end dates to see the windows this creates.
        </p>
      ) : (
        <>
          <p className="text-osrs-parchment-dark/70 text-xs">
            <strong className="text-osrs-parchment">
              {windows.length} scoring window{windows.length === 1 ? "" : "s"}
            </strong>{" "}
            · {formatDuration(totalWindowSeconds(windows))} of scoring time · first opens{" "}
            <LocalTime unix={windows[0]!.starts_at} />, last closes{" "}
            <LocalTime unix={windows[windows.length - 1]!.ends_at} />
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
            {windows.slice(0, PREVIEW_ROWS).map((w) => (
              <li key={w.starts_at} className="text-osrs-parchment-dark/60 min-w-0">
                <LocalTime unix={w.starts_at} /> → <LocalTime unix={w.ends_at} />
              </li>
            ))}
          </ul>
          {windows.length > PREVIEW_ROWS && (
            <p className="text-osrs-parchment-dark/50 text-xs">
              …and {windows.length - PREVIEW_ROWS} more, in your timezone.
            </p>
          )}
        </>
      )}
    </div>
  );
}
