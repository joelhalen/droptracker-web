/**
 * The /events timeline view (the default; the old sectioned grid is the
 * "List" view). A date strip across the top shows every dated event against a
 * Now line; below it, a vertical timeline: Live now, Coming up, Date not set
 * yet, then Past grouped by month.
 *
 * Server-rendered. Anything that depends on the viewer's timezone or clock
 * (dates, countdowns, the strip) is a small client island from local-time.tsx
 * or event-timeline-strip.tsx; the progress bars use the render instant.
 */
import type { Route } from "next";
import Link from "next/link";
import type { EventSummary } from "@droptracker/api-types";
import { EventTimelineStrip } from "@/components/event-timeline-strip";
import { DateTile, DraftStartNote, LocalTime, RelativeTime } from "@/components/local-time";
import {
  eventTypeLabel,
  groupByMonth,
  liveDayLabel,
  liveProgress,
  timelineIsEmpty,
  type TimelineBands,
} from "@/lib/event-timeline";

/** Past events shown before the rest fold behind "Show more". */
const PAST_VISIBLE = 6;

export function EventsTimeline({
  bands,
  yourIds,
  nowSec,
  signedIn,
}: {
  bands: TimelineBands;
  yourIds: Set<number>;
  nowSec: number;
  signedIn: boolean;
}) {
  if (timelineIsEmpty(bands)) return <EmptyTimeline signedIn={signedIn} />;

  const { live, upcoming, undated, past } = bands;
  const dated = [...live, ...upcoming, ...past];
  const nothingNow = !live.length && !upcoming.length;
  const pastShown = past.slice(0, PAST_VISIBLE);
  const pastRest = past.slice(PAST_VISIBLE);
  const endOf = (e: EventSummary) => e.ends_at ?? e.ended_at;

  return (
    <div className="space-y-10">
      {dated.length > 0 && <EventTimelineStrip events={dated} yourIds={[...yourIds]} />}

      {nothingNow && (
        <div className="border-osrs-bronze/25 bg-osrs-surface-1/40 rounded-lg border border-dashed px-4 py-3 text-sm">
          <p className="text-osrs-parchment">Nothing is live or coming up right now.</p>
          <p className="text-osrs-parchment-dark/60 mt-0.5 text-xs">
            {signedIn
              ? "New events from your clans show up here as soon as they're planned."
              : "Sign in to also see upcoming events from your clans."}
          </p>
        </div>
      )}

      {live.length > 0 && (
        <TimelineSection title="Live now" count={live.length} tone="live">
          {live.map((e) => (
            <LiveNode key={e.id} event={e} mine={yourIds.has(e.id)} nowSec={nowSec} />
          ))}
        </TimelineSection>
      )}

      {upcoming.length > 0 && (
        <TimelineSection title="Coming up" count={upcoming.length} tone="upcoming">
          {upcoming.map((e, i) => (
            <UpcomingNode key={e.id} event={e} mine={yourIds.has(e.id)} next={i === 0} />
          ))}
        </TimelineSection>
      )}

      {undated.length > 0 && (
        <TimelineSection
          title="Date not set yet"
          count={undated.length}
          tone="muted"
          hint="Planned, but without a start date. These won't start on their own."
        >
          {undated.map((e) => (
            <UpcomingNode key={e.id} event={e} mine={yourIds.has(e.id)} />
          ))}
        </TimelineSection>
      )}

      {past.length > 0 && (
        <TimelineSection title="Past" count={past.length} tone="muted">
          <PastMonths events={pastShown} at={endOf} yourIds={yourIds} />
          {pastRest.length > 0 && (
            <li className="list-none">
              <details className="group">
                <summary className="text-osrs-gold-bright ml-[60px] cursor-pointer py-1 text-sm hover:underline">
                  Show {pastRest.length} more past event{pastRest.length === 1 ? "" : "s"}
                </summary>
                <ol className="mt-4 space-y-4">
                  <PastMonths events={pastRest} at={endOf} yourIds={yourIds} />
                </ol>
              </details>
            </li>
          )}
        </TimelineSection>
      )}

      {!signedIn && !nothingNow && (
        <p className="text-osrs-parchment-dark/55 text-center text-xs">
          <SignInLink /> to also see upcoming events from your clans.
        </p>
      )}
    </div>
  );
}

// ── Layout pieces ────────────────────────────────────────────────────────────

const SECTION_DOT: Record<"live" | "upcoming" | "muted", string> = {
  live: "bg-osrs-gold event-glow-live",
  upcoming: "bg-osrs-green",
  muted: "bg-osrs-parchment-dark/40",
};

/** A heading plus an ordered list drawn on a vertical spine. The spine runs
 * through the centre of each row's 48px date tile. */
function TimelineSection({
  title,
  count,
  tone,
  hint,
  children,
}: {
  title: string;
  count: number;
  tone: "live" | "upcoming" | "muted";
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-osrs-gold mb-1 flex items-center gap-2.5 text-lg font-semibold">
        <span className={`${SECTION_DOT[tone]} inline-block h-2.5 w-2.5 rounded-full`} aria-hidden />
        {title}
        <span className="text-osrs-parchment-dark/50 text-sm font-normal">{count}</span>
      </h2>
      {hint && <p className="text-osrs-parchment-dark/55 mb-2 ml-5 text-xs">{hint}</p>}
      <div className="relative mt-4">
        <div
          className="bg-osrs-bronze/25 absolute top-2 bottom-2 left-[23px] w-px"
          aria-hidden
        />
        <ol className="relative space-y-4">{children}</ol>
      </div>
    </section>
  );
}

function Chips({ event: e, mine }: { event: EventSummary; mine: boolean }) {
  const chip = "rounded px-1.5 py-0.5 text-[11px] leading-none";
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className={`${chip} bg-osrs-bronze/25 text-osrs-parchment-dark/85`}>
        {eventTypeLabel(e)}
      </span>
      {e.mode === "clan_vs_clan" && (
        <span className={`${chip} bg-osrs-red/20 text-osrs-parchment`}>Clan vs clan</span>
      )}
      {mine && <span className={`${chip} bg-osrs-gold/20 text-osrs-gold`}>★ Your clan</span>}
      {e.has_schedule && (
        <span
          className={`${chip} bg-osrs-bronze/25 text-osrs-parchment-dark/80`}
          title={e.schedule_summary ?? undefined}
        >
          ⏱ Scoring windows
        </span>
      )}
    </span>
  );
}

function cardClass(extra = ""): string {
  return `border-osrs-bronze/25 hover:border-osrs-gold/60 bg-osrs-surface-1/50 block min-w-0 flex-1 rounded-lg border p-3.5 transition-colors ${extra}`;
}

// ── Nodes ────────────────────────────────────────────────────────────────────

function LiveNode({ event: e, mine, nowSec }: { event: EventSummary; mine: boolean; nowSec: number }) {
  const pct = liveProgress(e, nowSec);
  const day = liveDayLabel(e, nowSec);
  return (
    <li className="flex gap-3">
      <span className="border-osrs-gold/70 bg-osrs-brown-dark relative z-10 flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border">
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className="bg-osrs-gold absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping" />
          <span className="bg-osrs-gold relative inline-flex h-2.5 w-2.5 rounded-full" />
        </span>
        <span className="text-osrs-gold mt-1 text-[10px] font-bold tracking-wider">LIVE</span>
      </span>
      <Link href={`/events/${e.id}`} className={cardClass("border-osrs-gold/50 event-glow-live")}>
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-osrs-gold-bright min-w-0 truncate text-base font-semibold">
            {e.name}
          </span>
          <Chips event={e} mine={mine} />
        </span>
        {e.description && (
          <span className="text-osrs-parchment-dark/70 mt-1 line-clamp-2 text-sm">
            {e.description}
          </span>
        )}
        {pct != null && (
          <span
            className="bg-osrs-surface-3 mt-3 block h-1.5 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct * 100)}
            aria-label="Time elapsed"
          >
            <span
              className="from-osrs-gold/70 to-osrs-gold-bright block h-full rounded-full bg-gradient-to-r"
              style={{ width: `${Math.max(2, pct * 100)}%` }}
            />
          </span>
        )}
        <span className="text-osrs-parchment-dark/60 mt-1.5 flex flex-wrap gap-x-2 text-xs">
          {day && <span className="text-osrs-parchment-dark/80">{day}</span>}
          {e.ends_at != null ? (
            <span>
              Ends <LocalTime unix={e.ends_at} /> <RelativeTime unix={e.ends_at} prefix="·" />
            </span>
          ) : (
            <span>No end date</span>
          )}
        </span>
      </Link>
    </li>
  );
}

function UpcomingNode({
  event: e,
  mine,
  next = false,
}: {
  event: EventSummary;
  mine: boolean;
  /** The soonest upcoming event: gets a "Next up" marker. */
  next?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <span className="bg-osrs-surface-0 relative z-10 rounded-lg">
        <DateTile unix={e.starts_at} tone="upcoming" />
      </span>
      <Link href={`/events/${e.id}`} className={cardClass(next ? "border-osrs-green/50" : "")}>
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            {next && (
              <span className="bg-osrs-green/20 text-osrs-green shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none">
                Next up
              </span>
            )}
            <span className="text-osrs-gold-bright min-w-0 truncate font-semibold">{e.name}</span>
          </span>
          <Chips event={e} mine={mine} />
        </span>
        {e.description && (
          <span className="text-osrs-parchment-dark/70 mt-1 line-clamp-1 text-sm">
            {e.description}
          </span>
        )}
        <span className="text-osrs-parchment-dark/60 mt-1.5 block text-xs">
          {e.starts_at != null && (
            <>
              <LocalTime unix={e.starts_at} />
              {e.ends_at != null && (
                <>
                  {" to "}
                  <LocalTime unix={e.ends_at} />
                </>
              )}
              {durationLabel(e) && <span className="opacity-80"> · {durationLabel(e)}</span>}
            </>
          )}
        </span>
        <span className="text-osrs-green/85 mt-0.5 block text-xs">
          <DraftStartNote startsAt={e.starts_at} />
        </span>
      </Link>
    </li>
  );
}

function PastMonths({
  events,
  at,
  yourIds,
}: {
  events: EventSummary[];
  at: (e: EventSummary) => number | null | undefined;
  yourIds: Set<number>;
}) {
  return (
    <>
      {groupByMonth(events, at).map((g) => (
        <li key={g.label} className="list-none">
          <p className="text-osrs-parchment-dark/50 mb-2 ml-[60px] text-[11px] font-semibold tracking-wider uppercase">
            {g.label}
          </p>
          <ol className="space-y-2">
            {g.events.map((e) => (
              <li key={e.id} className="flex items-center gap-3">
                <span className="bg-osrs-surface-0 relative z-10 rounded-lg">
                  <DateTile unix={at(e)} tone="muted" />
                </span>
                <Link
                  href={`/events/${e.id}`}
                  className="border-osrs-bronze/15 hover:border-osrs-gold/40 flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border px-3.5 py-2.5 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="text-osrs-parchment block truncate font-medium">{e.name}</span>
                    <span className="text-osrs-parchment-dark/50 block text-xs">
                      {e.starts_at != null && (
                        <>
                          <LocalTime unix={e.starts_at} mode="date" />
                          {" to "}
                        </>
                      )}
                      <LocalTime unix={at(e)} mode="date" />
                    </span>
                  </span>
                  <Chips event={e} mine={yourIds.has(e.id)} />
                </Link>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </>
  );
}

/** "7 days" / "36 hours" for a dated window, or null. */
function durationLabel(e: EventSummary): string | null {
  if (e.starts_at == null || e.ends_at == null || e.ends_at <= e.starts_at) return null;
  const hours = Math.round((e.ends_at - e.starts_at) / 3600);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} days`;
}

function SignInLink() {
  return (
    <Link
      href={`/api/auth/login?redirect=${encodeURIComponent("/events")}` as Route}
      prefetch={false}
      className="text-osrs-gold-bright hover:underline"
    >
      Sign in
    </Link>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyTimeline({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="border-osrs-bronze/25 bg-osrs-surface-1/40 flex flex-col items-center rounded-lg border border-dashed px-6 py-12 text-center">
      {/* A tiny empty timeline: a Now marker and three open slots. */}
      <svg viewBox="0 0 220 44" className="h-11 w-56" aria-hidden>
        <line x1="10" y1="30" x2="210" y2="30" className="stroke-osrs-bronze/40" strokeWidth="2" />
        <circle cx="50" cy="30" r="6" className="fill-osrs-surface-1 stroke-osrs-bronze/50" strokeWidth="2" />
        <circle cx="130" cy="30" r="6" className="fill-osrs-surface-1 stroke-osrs-bronze/50" strokeWidth="2" />
        <circle cx="180" cy="30" r="6" className="fill-osrs-surface-1 stroke-osrs-bronze/50" strokeWidth="2" />
        <line x1="90" y1="8" x2="90" y2="40" className="stroke-osrs-gold" strokeWidth="2" />
        <rect x="74" y="0" width="32" height="13" rx="3" className="fill-osrs-gold" />
        <text x="90" y="10" textAnchor="middle" className="fill-osrs-brown-dark" fontSize="9" fontWeight="700">
          Now
        </text>
      </svg>
      <p className="text-osrs-gold mt-5 text-lg font-semibold">Nothing on the timeline yet</p>
      {signedIn ? (
        <p className="text-osrs-parchment-dark/70 mt-1 max-w-md text-sm">
          When a clan you&apos;re in plans an event, it shows up here with its dates.
        </p>
      ) : (
        <p className="text-osrs-parchment-dark/70 mt-1 max-w-md text-sm">
          <SignInLink /> to see events from your clans, including ones that haven&apos;t
          started yet.
        </p>
      )}
      <Link
        href="/premium"
        className="text-osrs-gold-bright mt-4 text-sm hover:underline"
      >
        Want to host one? See the Patron tier
      </Link>
    </div>
  );
}
