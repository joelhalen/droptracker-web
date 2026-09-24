import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import type { EventSummary } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { pickYourEvents, sortEventsChronologically } from "@/lib/events";
import { EventRecruitingBanner } from "@/components/event-recruiting-banner";
import { DraftStartNote, EventWindow } from "@/components/local-time";
import { EventsTimeline } from "@/components/events-timeline";
import { EventsViewSwitch } from "@/components/events-view-switch";
import { buildTimelineBands, EVENTS_VIEW_COOKIE, resolveEventsView } from "@/lib/event-timeline";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Events",
  description: "Active and past DropTracker clan events, bingos, and competitions.",
};

type SearchParams = Promise<{ view?: string | string[] }>;

export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  const [{ view: viewParam }, jar] = await Promise.all([searchParams, cookies()]);
  // Timeline is the default; the List view (the sectioned grid below) stays
  // one click away and the choice sticks via a cookie.
  const view = resolveEventsView(viewParam, jar.get(EVENTS_VIEW_COOKIE)?.value);
  const user = await getUser().catch(() => null);
  const [active, past, upcoming, recruiting, mine] = await Promise.all([
    api.events({ status: "active" }),
    api.events({ status: "past" }),
    // Drafts the signed-in viewer may see: events of clans they belong to
    // (pre-publication landing) plus drafts they administer.
    user ? api.eventsForAdmin({ status: "draft" }).catch(() => []) : Promise.resolve([]),
    user ? api.eventRecruiting().catch(() => []) : Promise.resolve([]),
    user ? api.eventsMine().catch(() => []) : Promise.resolve([]),
  ]);
  // "Your events" absorbs the viewer's live + upcoming clan events; the
  // general lists below only keep what ISN'T shown there, so no event
  // appears twice on the page.
  const yourEvents = pickYourEvents(mine);
  const yourIds = new Set(yourEvents.map((e) => e.id));
  // The API lists newest-created first; each section reads by date instead
  // (upcoming by start, active by end, past by most recent end).
  const otherUpcoming = sortEventsChronologically(upcoming.filter((e) => !yourIds.has(e.id)));
  const otherActive = sortEventsChronologically(active.filter((e) => !yourIds.has(e.id)));
  const pastSorted = sortEventsChronologically(past);
  const nowSec = Math.floor(Date.now() / 1000);

  return (
    <div className="space-y-10">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-osrs-gold text-2xl font-bold">Events & Competitions</h1>
          <EventsViewSwitch current={view} />
        </div>
        <p className="text-osrs-parchment-dark/70 mt-2 max-w-3xl text-sm">
          Bingo boards, team races and task lists run by DropTracker groups, built from real
          in-game goals. Progress tracks itself through the RuneLite plugin and updates live here
          and in the group&apos;s Discord. Any group can host events for free, and a{" "}
          <Link href="/premium" className="text-osrs-gold-bright hover:underline">
            subscription
          </Link>{" "}
          lets you run more of them.
        </p>
      </header>
      {recruiting.length > 0 && <EventRecruitingBanner items={recruiting} />}
      {view === "timeline" ? (
        <EventsTimeline
          // "Your events" first so its copy of an event wins the dedupe.
          bands={buildTimelineBands(yourEvents, upcoming, active, past)}
          yourIds={yourIds}
          nowSec={nowSec}
          signedIn={user != null}
        />
      ) : (
        <ListView
          yourEvents={yourEvents}
          upcoming={otherUpcoming}
          active={otherActive}
          past={pastSorted}
        />
      )}
    </div>
  );
}

/** The sectioned grid: the page as it was before the timeline, kept as the
 * "List" view. */
function ListView({
  yourEvents,
  upcoming: otherUpcoming,
  active: otherActive,
  past: pastSorted,
}: {
  yourEvents: EventSummary[];
  upcoming: EventSummary[];
  active: EventSummary[];
  past: EventSummary[];
}) {
  return (
    <>
      {yourEvents.length > 0 && (
        <EventSection title="Your events" events={yourEvents} empty="" glowLive />
      )}
      {otherUpcoming.length > 0 && (
        <EventSection title="Upcoming" events={otherUpcoming} empty="" />
      )}
      <EventSection title="Active" events={otherActive} empty="No active events right now." />
      <EventSection title="Past" events={pastSorted} empty="No past events yet." />
    </>
  );
}

function EventSection({
  title,
  events,
  empty,
  glowLive = false,
}: {
  title: string;
  events: EventSummary[];
  empty: string;
  /** "Your events" only: live cards get the gold glow + a Live chip. */
  glowLive?: boolean;
}) {
  return (
    <section>
      <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">{title}</h2>
      {events.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.id}`}
                className={
                  glowLive && e.status === "active"
                    ? "border-osrs-gold/60 hover:border-osrs-gold event-glow-live block rounded border p-4 transition-colors"
                    : "border-osrs-bronze/20 hover:border-osrs-gold/50 block rounded border p-4 transition-colors"
                }
              >
                <div className="flex items-center gap-2">
                  <span className="text-osrs-gold-bright font-medium">{e.name}</span>
                  {glowLive && e.status === "active" && (
                    <span className="bg-osrs-gold/20 text-osrs-gold rounded px-1.5 py-0.5 text-xs">
                      ⚡ Live
                    </span>
                  )}
                  {e.status === "draft" && (
                    <span className="bg-osrs-green/15 text-osrs-green rounded px-1.5 py-0.5 text-xs">
                      Upcoming
                    </span>
                  )}
                  {e.has_bingo && (
                    <span className="bg-osrs-gold/20 text-osrs-gold rounded px-1.5 py-0.5 text-xs">
                      Bingo
                    </span>
                  )}
                  {/* Scheduled events score only in repeating windows (web82a).
                      Whether one is open right now needs the compiled window
                      list, which only the detail payload carries — the card
                      flags the pattern and the event page says live/paused. */}
                  {e.has_schedule && (
                    <span
                      className="bg-osrs-bronze/25 text-osrs-parchment-dark/80 rounded px-1.5 py-0.5 text-xs"
                      title={e.schedule_summary ?? undefined}
                    >
                      ⏱ Scheduled
                    </span>
                  )}
                </div>
                {e.description && (
                  <p className="text-osrs-parchment-dark/70 mt-1 line-clamp-2 text-sm">
                    {e.description}
                  </p>
                )}
                {(e.starts_at != null || e.ends_at != null) && (
                  <p className="text-osrs-parchment-dark/50 mt-2 text-xs">
                    <EventWindow startsAt={e.starts_at} endsAt={e.ends_at} status={e.status} />
                  </p>
                )}
                {/* A draft with a start date goes live on its own at that time;
                    say so, so a planned event doesn't start by surprise. */}
                {e.status === "draft" && (
                  <p className="text-osrs-green/80 mt-0.5 text-xs">
                    <DraftStartNote startsAt={e.starts_at} />
                  </p>
                )}
                {e.schedule_summary && (
                  <p className="text-osrs-parchment-dark/50 mt-0.5 text-xs">
                    ⏱ Scores in windows · {e.schedule_summary}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-osrs-parchment-dark/60 text-sm">{empty}</p>
      )}
    </section>
  );
}
