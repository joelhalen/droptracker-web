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
