"use client";

/**
 * Timezone-aware timestamp display for event schedules.
 *
 * Event times are unix seconds (UTC) end-to-end; only the timezone they are
 * *rendered* in varies. Public pages are statically cached and shared across
 * viewers, so server HTML (and the first client paint) always shows UTC with
 * an explicit "UTC" label; after hydration each viewer's browser re-renders
 * the same instant in their own timezone, again with an explicit zone label,
 * so it is never ambiguous which timezone a time is displayed in.
 */

import { useEffect, useState } from "react";
import type { EventScheduleState } from "@droptracker/api-types";
import { scheduleStatusAt } from "@/lib/event-schedule";

/** True only after hydration — gates browser-timezone rendering. */
function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};
const DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTS,
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};

function fmt(unix: number, opts: Intl.DateTimeFormatOptions, utc: boolean): string {
  return new Intl.DateTimeFormat(undefined, utc ? { ...opts, timeZone: "UTC" } : opts).format(
    new Date(unix * 1000),
  );
}

/** The viewer's IANA zone, e.g. "Europe/Stockholm" (browser only). */
export function viewerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** The viewer's current UTC offset label, e.g. "GMT+2" (browser only). */
export function viewerOffsetLabel(): string {
  const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "shortOffset" }).formatToParts(
    new Date(),
  );
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

/** "in 3 days" / "5 hours ago" for the largest sensible unit. */
export function relativeLabel(unix: number, nowMs = Date.now()): string {
  const diffSec = unix - Math.floor(nowMs / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "always" });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.trunc(diffSec / 60), "minute");
  if (abs < 172800) return rtf.format(Math.trunc(diffSec / 3600), "hour");
  return rtf.format(Math.trunc(diffSec / 86400), "day");
}

/**
 * One timestamp in the viewer's timezone (UTC until hydration), with a
 * tooltip carrying the UTC form so the two are always cross-checkable.
 * `mode="date"` drops the time (and zone label) for compact contexts.
 */
export function LocalTime({
  unix,
  mode = "datetime",
  className,
}: {
  unix: number | null | undefined;
  mode?: "date" | "datetime";
  className?: string;
}) {
  const mounted = useMounted();
  if (unix == null) return <span className={className}>—</span>;
  const opts = mode === "date" ? DATE_OPTS : DATETIME_OPTS;
  const utcFull = `${fmt(unix, DATETIME_OPTS, true)}`;
  return (
    <time
      dateTime={new Date(unix * 1000).toISOString()}
      title={mounted ? `${utcFull} · shown in ${viewerZone()}` : utcFull}
      className={className}
      suppressHydrationWarning
    >
      {fmt(unix, opts, !mounted)}
    </time>
  );
}

/**
 * An event's scheduled window ("start – end") plus a live hint relating it to
 * the viewer's clock ("starts in 3 days" / "ends in 5 hours" / "ended
 * 2 days ago"). The hint only renders after hydration — it depends on the
 * viewer's clock, which cached server HTML can't know.
 */
export function EventWindow({
  startsAt,
  endsAt,
  status,
  className,
}: {
  startsAt: number | null | undefined;
  endsAt: number | null | undefined;
  status?: "draft" | "active" | "past";
  className?: string;
}) {
  const mounted = useMounted();
  const now = Math.floor(Date.now() / 1000);
  let hint: string | null = null;
  if (mounted) {
    if (status === "past" && endsAt) hint = `ended ${relativeLabel(endsAt, now * 1000)}`;
    else if (startsAt && startsAt > now) hint = `starts ${relativeLabel(startsAt, now * 1000)}`;
    else if (endsAt && endsAt > now) hint = `ends ${relativeLabel(endsAt, now * 1000)}`;
    else if (endsAt && endsAt <= now) hint = `ended ${relativeLabel(endsAt, now * 1000)}`;
  }
  return (
    <span className={className} suppressHydrationWarning>
      <LocalTime unix={startsAt} /> – <LocalTime unix={endsAt} />
      {hint && <span className="opacity-80"> · {hint}</span>}
    </span>
  );
}

/**
 * A slow wall-clock tick. The compiled scoring windows are already in the
 * payload, so a window boundary can flip the badge in place — no refetch, no
 * stale "Scoring live" sitting there until the viewer navigates.
 */
function useSlowTick(active: boolean, everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [active, everyMs]);
  return now;
}

/** Weekday + clock ("Sat, 00:00 UTC") — the compact form for "the next
 * scoring window opens …", where the date is usually days away at most. */
const WEEKDAY_OPTS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};

/**
 * Live/paused state of a scheduled event's scoring (web82a). A scheduled event
 * stays `active` between its windows — channels, pages and standings all stay
 * up — so without this a paused event looks identical to a running one and
 * players wonder why their drops aren't counting.
 *
 * The open/next answers are re-derived from the compiled windows after
 * hydration: event pages are statically cached, so the server's `scoring_open`
 * can be minutes (or a whole window) stale by the time it reaches a viewer.
 */
export function ScoringWindowBadge({
  schedule,
  status,
  className = "",
}: {
  schedule: EventScheduleState | null | undefined;
  status?: "draft" | "active" | "past";
  className?: string;
}) {
  const mounted = useMounted();
  const nowMs = useSlowTick(status === "active" && (schedule?.windows.length ?? 0) > 0);
  if (!schedule || status !== "active") return null;

  const derived =
    mounted && schedule.windows.length
      ? scheduleStatusAt(schedule.windows, Math.floor(nowMs / 1000))
      : null;
  const open = derived ? derived.open : schedule.scoring_open;
  const current = derived ? derived.current : (schedule.current_window ?? null);
  const next = derived ? derived.next : (schedule.next_window ?? null);

  const tone = open
    ? "bg-osrs-green/15 text-osrs-green"
    : "bg-osrs-bronze/25 text-osrs-parchment-dark/80";
  return (
    <span
      className={`${tone} inline-flex min-w-0 flex-wrap items-center gap-x-1 rounded px-1.5 py-0.5 text-xs ${className}`}
      suppressHydrationWarning
    >
      {open ? (
        <>
          <span>● Scoring live</span>
          {current && (
            <span className="opacity-80">
              {mounted ? `— window closes ${relativeLabel(current.ends_at, nowMs)}` : "— in a window"}
            </span>
          )}
        </>
      ) : (
        <>
          <span>⏸ Scoring paused</span>
          <span className="opacity-80">
            {next ? (
              <>
                {"— next window opens "}
                {fmt(next.starts_at, WEEKDAY_OPTS, !mounted)}
                {mounted && ` (${relativeLabel(next.starts_at, nowMs)})`}
              </>
            ) : (
              "— no scoring windows left"
            )}
          </span>
        </>
      )}
    </span>
  );
}

/**
 * "18:00 UTC — 7:00 PM your time": makes a schedule's UTC clock concrete for
 * the organizer entering it. Schedules are authored in UTC (game time) on
 * purpose, so this never *replaces* the UTC value — it only translates it.
 * Empty until hydration (the viewer's zone is browser-only).
 */
export function UtcClockNote({ time, className }: { time: string; className?: string }) {
  const mounted = useMounted();
  const local = (() => {
    const [rawHh, rawMm] = time.split(":");
    const hh = Number(rawHh);
    const mm = Number(rawMm);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    const now = new Date();
    const unix = Math.floor(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm) / 1000,
    );
    return fmt(unix, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }, false);
  })();
  return (
    <span className={className} suppressHydrationWarning>
      {mounted && local ? `${time} UTC is ${local} your time` : ""}
    </span>
  );
}

/**
 * Form helper for datetime-local inputs: names the timezone values are being
 * entered in. Empty until hydration (the zone is only knowable in-browser).
 */
export function TimezoneNote({ className }: { className?: string }) {
  const mounted = useMounted();
  return (
    <span className={className} suppressHydrationWarning>
      {mounted
        ? `Times are entered in your timezone — ${viewerZone()} (${viewerOffsetLabel()}). Participants see them converted to their own timezone.`
        : ""}
    </span>
  );
}
