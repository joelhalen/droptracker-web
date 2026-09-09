"use client";

/**
 * Charts for the group diagnostics panel (web111a).
 *
 * Client-side for two reasons, both about honesty rather than interactivity:
 *
 *  - The backend measures hours in UTC (`date_hour` in the rollup). "When is my
 *    clan online" is a question about the admin's own clock, so the heatmap is
 *    rotated by the viewer's UTC offset here, after hydration. Server HTML
 *    renders the UTC frame and says so, then the browser relabels it — the same
 *    contract `local-time.tsx` uses for event schedules.
 *  - The bars need a real hover readout, and a `title` attribute on a 90-column
 *    chart is not one.
 *
 * The chart this replaces rendered nothing at all. Its bars were percentage
 * heights inside a column that the parent's `items-end` left at content height,
 * so every `height: N%` resolved against an indefinite height and collapsed to
 * 0px. Measured on production before the fix: seven bars carrying `height`
 * 23%–100%, every one of them `getBoundingClientRect().height === 0`, under a
 * 160px-tall row. The data had been there the whole time.
 *
 * The fix is `items-stretch` on the fixed-height row: each column now takes a
 * definite height from the parent, so the bars' percentages have something real
 * to resolve against. Any future edit that puts `items-end` back brings the bug
 * back with it.
 */

import { useEffect, useMemo, useState } from "react";
import { formatGp } from "@/lib/format";
import {
  DAY_LABELS,
  hourLabel,
  localiseHourMatrix,
  peakHour,
  shortDate,
} from "@/lib/diagnostics";

/** True only after hydration — gates browser-timezone rendering. */
function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export type DailyPoint = {
  date: string;
  drops: number;
  gp: number;
  players: number;
  announcements: number;
};

type Metric = "drops" | "gp" | "players" | "announcements";

const METRICS: { key: Metric; label: string; format: (n: number) => string }[] = [
  { key: "drops", label: "Drops", format: (n) => n.toLocaleString() },
  { key: "gp", label: "Loot", format: (n) => formatGp(n) },
  { key: "players", label: "Active players", format: (n) => n.toLocaleString() },
  { key: "announcements", label: "Discord posts", format: (n) => n.toLocaleString() },
];

/* -------------------------------------------------------------------------- */
/* Daily activity                                                              */
/* -------------------------------------------------------------------------- */

export function ActivityChart({ daily }: { daily: DailyPoint[] }) {
  const [metric, setMetric] = useState<Metric>("drops");
  const [hover, setHover] = useState<number | null>(null);

  const spec = METRICS.find((m) => m.key === metric)!;
  const max = Math.max(1, ...daily.map((d) => d[metric]));
  const active = hover != null ? daily[hover] : null;
  // Labelling every column is unreadable past a fortnight, so thin them to a
  // handful of evenly spaced ticks instead of rotating text.
  const labelEvery = Math.max(1, Math.ceil(daily.length / 10));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                m.key === metric
                  ? "bg-osrs-gold/20 text-osrs-gold-bright"
                  : "text-osrs-parchment-dark/60 hover:text-osrs-parchment"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="text-osrs-parchment-dark/70 min-h-[1.25rem] text-xs tabular-nums">
          {active ? (
            <>
              <span className="text-osrs-gold-bright font-semibold">
                {spec.format(active[metric])}
              </span>{" "}
              on {active.date}
            </>
          ) : (
            <>Peak {spec.format(max)}</>
          )}
        </div>
      </div>

      <div
        className="flex h-44 items-stretch gap-px"
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`${spec.label} per day for the selected window`}
      >
        {daily.map((d, i) => (
          <div
            key={d.date}
            className="group flex flex-1 flex-col justify-end"
            onMouseEnter={() => setHover(i)}
          >
            <div
              className={`w-full rounded-t transition-colors ${
                hover === i ? "bg-osrs-gold-bright" : "bg-osrs-bronze group-hover:bg-osrs-gold"
              }`}
              // Explicit pixel height against a fixed-height flex column. The
              // 2px floor keeps a real-but-tiny day visually distinct from a
              // zero day, which a pure ratio would flatten into the axis.
              style={{
                height: d[metric] > 0 ? `${Math.max(2, (d[metric] / max) * 100)}%` : "0px",
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-1 flex gap-px">
        {daily.map((d, i) => (
          <div
            key={d.date}
            className="text-osrs-parchment-dark/50 flex-1 text-center text-[10px] tabular-nums"
          >
            {i % labelEvery === 0 ? shortDate(d.date) : " "}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* When the clan plays                                                         */
/* -------------------------------------------------------------------------- */

export function ActivityHeatmap({ matrix }: { matrix: number[][] }) {
  const mounted = useMounted();
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);

  // Server render (and first paint) stays in UTC so the markup matches; the
  // browser then shifts it into the viewer's zone.
  const offsetMinutes = mounted ? -new Date().getTimezoneOffset() : 0;
  const zone = mounted
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || "local time"
    : "UTC";

  const local = useMemo(
    () => localiseHourMatrix(matrix, offsetMinutes),
    [matrix, offsetMinutes],
  );
  const max = Math.max(1, ...local.flat());
  const peak = peakHour(local);
  const hovered = hover ? local[hover.d]?.[hover.h] ?? 0 : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="text-osrs-parchment-dark/70">
          {hover ? (
            <>
              <span className="text-osrs-gold-bright font-semibold tabular-nums">
                {hovered!.toLocaleString()}
              </span>{" "}
              drops · {DAY_LABELS[hover.d]} {hourLabel(hover.h)}
            </>
          ) : peak ? (
            <>
              Busiest:{" "}
              <span className="text-osrs-gold-bright font-semibold">
                {DAY_LABELS[peak[0]]} around {hourLabel(peak[1])}
              </span>
            </>
          ) : (
            <>No tracked activity in this window</>
          )}
        </span>
        <span className="text-osrs-parchment-dark/50">Times shown in {zone}</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[34rem]">
          {local.map((row, d) => (
            <div key={d} className="flex items-center gap-1">
              <span className="text-osrs-parchment-dark/50 w-8 shrink-0 text-right text-[10px]">
                {DAY_LABELS[d]}
              </span>
              <div className="flex flex-1 gap-px">
                {row.map((v, h) => (
                  <div
                    key={h}
                    onMouseEnter={() => setHover({ d, h })}
                    onMouseLeave={() => setHover(null)}
                    // Opacity rather than a colour ramp: one hue keeps this
                    // legible for the ~8% of players with red/green deficiency,
                    // and the square is 10px — a legend would cost more room
                    // than the cell.
                    className="bg-osrs-gold h-4 flex-1 rounded-[1px] transition-opacity"
                    style={{ opacity: v === 0 ? 0.05 : 0.15 + 0.85 * (v / max) }}
                    title={`${DAY_LABELS[d]} ${hourLabel(h)} — ${v.toLocaleString()} drops`}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="mt-1 flex items-center gap-1">
            <span className="w-8 shrink-0" />
            <div className="text-osrs-parchment-dark/40 flex flex-1 justify-between text-[10px]">
              {[0, 6, 12, 18, 23].map((h) => (
                <span key={h}>{hourLabel(h)}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
