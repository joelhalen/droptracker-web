"use client";

/**
 * The date strip at the top of the /events timeline: one bar per event on a
 * shared date axis with a "Now" line, so overlaps and gaps read at a glance
 * without opening each event.
 *
 * Drawn only after hydration. Tick positions and labels depend on the
 * viewer's timezone, which the cached server HTML can't know; a placeholder
 * of the same height holds the space until then, so nothing jumps.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { EventSummary } from "@droptracker/api-types";
import {
  localMidnight,
  pickStripRows,
  stripBars,
  stripPos,
  stripTicks,
  stripWindow,
  type StripBar,
} from "@/lib/event-timeline";

/** Rows shown before the rest are summarised as "+N more". */
const MAX_ROWS = 8;
const ROW_PX = 30;
const AXIS_PX = 22;

const DAY_FMT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const FULL_FMT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

function fmt(t: number, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, opts).format(new Date(t * 1000));
}

function barTitle(b: StripBar): string {
  const e = b.event;
  const start = e.starts_at ?? e.activated_at;
  const end = e.ends_at ?? e.ended_at;
  const range = [start != null ? fmt(start, FULL_FMT) : "?", end != null ? fmt(end, FULL_FMT) : "open"];
  return `${e.name}: ${range.join(" to ")}`;
}

const BAR_TONE: Record<EventSummary["status"], string> = {
  active: "bg-osrs-gold event-glow-live",
  draft: "bg-osrs-green/70",
  past: "bg-osrs-parchment-dark/25",
};
const LABEL_TONE: Record<EventSummary["status"], string> = {
  active: "text-osrs-gold-bright font-semibold",
  draft: "text-osrs-parchment",
  past: "text-osrs-parchment-dark/55",
};

export function EventTimelineStrip({
  events,
  yourIds = [],
}: {
  events: EventSummary[];
  /** The viewer's clans' events: their labels get a small marker. */
  yourIds?: number[];
}) {
  const [nowSec, setNowSec] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const drawn = nowSec != null;
  useEffect(() => {
    setNowSec(Math.floor(Date.now() / 1000));
    // The Now line creeps; a minute is plenty for a multi-week axis.
    const timer = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 60_000);
    return () => clearInterval(timer);
  }, []);

  // On a phone the chart is wider than its box: start it scrolled so Now sits
  // a third of the way in, with what's live and next in view. Once, on first
  // draw; after that the viewer's own scrolling wins.
  useEffect(() => {
    const el = scroller.current;
    if (!drawn || !el || el.scrollWidth <= el.clientWidth) return;
    const now = el.querySelector<HTMLElement>("[data-now]");
    if (now) el.scrollLeft = Math.max(0, now.offsetLeft - el.clientWidth / 3);
  }, [drawn]);

  if (nowSec == null) {
    // Same footprint as the drawn strip for the typical case, so the page
    // below doesn't shift when it appears.
    const rows = Math.min(MAX_ROWS, Math.max(1, events.length));
    return (
      <div
        aria-hidden
        className="border-osrs-bronze/20 bg-osrs-surface-1/40 animate-pulse rounded-lg border"
        style={{ height: AXIS_PX + rows * ROW_PX + 44 }}
      />
    );
  }

  const w = stripWindow(events, nowSec);
  const bars = stripBars(events, w, nowSec);
  if (!bars.length) return null;
  const { rows: shown, hidden } = pickStripRows(bars, MAX_ROWS);
  // Denser ticks on a short axis so it never shows just one or two dates.
  const spanDays = (w.to - w.from) / 86_400;
  const ticks = stripTicks(w, localMidnight, spanDays <= 45 ? 3 : spanDays <= 90 ? 7 : 14);
  const nowPct = stripPos(nowSec, w);
  const mine = new Set(yourIds);

  return (
    <figure className="border-osrs-bronze/20 bg-osrs-surface-1/40 rounded-lg border p-3 sm:p-4">
      <figcaption className="sr-only">
        Event dates from {fmt(w.from, DAY_FMT)} to {fmt(w.to, DAY_FMT)}
      </figcaption>
      {/* The chart keeps a readable minimum width and scrolls sideways inside
          its own box on narrow phones; the page itself never scrolls. */}
      <div ref={scroller} className="-mx-1 overflow-x-auto px-1">
        <div className="relative min-w-[520px]" style={{ height: AXIS_PX + shown.length * ROW_PX }}>
          {/* Week gridlines + labels */}
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute top-0 bottom-0"
              style={{ left: `${stripPos(t, w)}%` }}
              aria-hidden
            >
              <div className="border-osrs-bronze/15 absolute top-[18px] bottom-0 border-l" />
              {/* No label where it would be clipped at an edge or sit under
                  the Now chip; the gridline still marks the week. */}
              {stripPos(t, w) > 3 &&
                stripPos(t, w) < 96 &&
                Math.abs(stripPos(t, w) - nowPct) > 7 && (
                  <span className="text-osrs-parchment-dark/45 absolute top-0 -translate-x-1/2 text-[10px] whitespace-nowrap">
                    {fmt(t, DAY_FMT)}
                  </span>
                )}
            </div>
          ))}

          {/* Now line */}
          <div
            data-now
            className="pointer-events-none absolute top-0 bottom-0 z-10"
            style={{ left: `${nowPct}%` }}
            aria-hidden
          >
            <span className="bg-osrs-gold text-osrs-brown-dark absolute top-0 -translate-x-1/2 rounded px-1.5 text-[10px] font-bold leading-4">
              Now
            </span>
            <div className="bg-osrs-gold/70 absolute top-4 bottom-0 w-px" />
          </div>

          {/* One row per event */}
          {shown.map((b, i) => {
            const e = b.event;
            const rightAlign = b.left > 55;
            const labelStyle = rightAlign
              ? { right: `${Math.max(0, 100 - (b.left + b.width))}%` }
              : { left: `${b.left}%` };
            return (
              <Link
                key={e.id}
                href={`/events/${e.id}`}
                title={barTitle(b)}
                aria-label={barTitle(b)}
                className="group absolute right-0 left-0 z-20 block"
                style={{ top: AXIS_PX + i * ROW_PX, height: ROW_PX }}
              >
                <span
                  className={`${LABEL_TONE[e.status]} group-hover:text-osrs-gold-bright absolute top-0 max-w-[60%] truncate text-[11px] leading-4 ${rightAlign ? "text-right" : ""}`}
                  style={labelStyle}
                >
                  {mine.has(e.id) && <span className="text-osrs-gold mr-1">★</span>}
                  {e.name}
                </span>
                <span
                  className={`${BAR_TONE[e.status]} absolute top-[17px] h-2 transition-[filter] group-hover:brightness-125 ${b.clippedStart ? "rounded-l-none" : "rounded-l-full"} ${b.clippedEnd || b.openEnded ? "rounded-r-none" : "rounded-r-full"}`}
                  style={{
                    left: `${b.left}%`,
                    width: `${b.width}%`,
                    ...(b.openEnded
                      ? {
                          maskImage: "linear-gradient(to right, #000 70%, transparent)",
                          WebkitMaskImage: "linear-gradient(to right, #000 70%, transparent)",
                        }
                      : {}),
                  }}
                />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="text-osrs-parchment-dark/55 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <Legend tone="bg-osrs-gold">Live</Legend>
        <Legend tone="bg-osrs-green/70">Coming up</Legend>
        <Legend tone="bg-osrs-parchment-dark/25">Ended</Legend>
        {mine.size > 0 && (
          <span>
            <span className="text-osrs-gold">★</span> Your clan
          </span>
        )}
        {hidden > 0 && <span className="ml-auto">+{hidden} more in the list below</span>}
      </div>
    </figure>
  );
}

function Legend({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`${tone} inline-block h-2 w-4 rounded-full`} aria-hidden />
      {children}
    </span>
  );
}
