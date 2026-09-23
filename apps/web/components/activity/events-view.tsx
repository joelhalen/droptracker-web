"use client";

/**
 * Events tab: the launch guild's upcoming + active events (plus recent past
 * ones), pushing the full live event screen (board/tasks/join) on tap.
 * Launched without a guild (an Activity Link opened from a DM), it falls
 * back to the session user's events across every group they belong to.
 * Upcoming (draft) events only come back for signed-in members of a
 * participating clan — the pre-publication landing page.
 *
 * Signed-in viewers also get the site's "Your clans are recruiting" banner:
 * clan-vs-clan events their clans have joined that they haven't opted into.
 * It follows the viewer (like the site's), not the launch server.
 */
import { useEffect, useState } from "react";
import type { EventRecruitingItem, EventSummary } from "@droptracker/api-types";
import { Card } from "@/components/ui";
import { EventRecruitingBanner } from "@/components/event-recruiting-banner";
import { DraftStartNote, EventWindow } from "@/components/local-time";
import { sortEventsChronologically } from "@/lib/events";
import { eventRecruiting, guildEvents, myEvents } from "@/lib/activity/api";
import { useActivityAuth } from "@/lib/activity/auth-context";
import { useActivityData } from "@/lib/activity/data-context";
import { useActivityNav } from "@/lib/activity/nav";
import { ErrorNote, LoadingBlock, SectionHeading } from "@/components/activity/bits";

function EventRow({ event, phase }: { event: EventSummary; phase: "upcoming" | "live" | "past" }) {
  const nav = useActivityNav();
  return (
    <button
      onClick={() => nav.push({ name: "event", id: event.id })}
      className="border-osrs-bronze/30 bg-osrs-surface-1 hover:border-osrs-bronze/60 w-full rounded-2xl border p-3.5 text-left transition-colors"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-osrs-gold truncate font-serif text-[15px] font-semibold">{event.name}</span>
        {phase === "live" && (
          <span className="text-osrs-green shrink-0 text-[10px] font-bold tracking-wider uppercase">● Live</span>
        )}
        {phase === "upcoming" && (
          <span className="text-osrs-gold-bright shrink-0 text-[10px] font-bold tracking-wider uppercase">Upcoming</span>
        )}
        {phase === "past" && (
          <span className="text-osrs-parchment-dark/45 shrink-0 text-[10px] uppercase">Ended</span>
        )}
      </span>
      {event.description && (
        <span className="text-osrs-parchment-dark/60 mt-0.5 line-clamp-2 block text-[12px]">
          {event.description}
        </span>
      )}
      <span className="text-osrs-parchment-dark/50 mt-1 block text-[11px]">
        <EventWindow startsAt={event.starts_at} endsAt={event.ends_at} status={event.status} />
        {event.has_bingo && " · bingo"}
      </span>
      {phase === "upcoming" && (
        <span className="text-osrs-green/80 mt-0.5 block text-[11px]">
          <DraftStartNote startsAt={event.starts_at} />
        </span>
      )}
      {/* Scheduled events (web82a) only score inside repeating windows. The
          list payload can't say whether one is open right now — the event
          screen shows that — so the row just names the pattern. */}
      {event.schedule_summary && (
        <span className="text-osrs-parchment-dark/45 mt-0.5 block truncate text-[11px]">
          ⏱ {event.schedule_summary}
        </span>
      )}
    </button>
  );
}

export function EventsView() {
  const nav = useActivityNav();
  const { guildId } = useActivityData();
  const { sessionToken } = useActivityAuth();
  const [active, setActive] = useState<EventSummary[] | null>(null);
  const [upcoming, setUpcoming] = useState<EventSummary[]>([]);
  const [past, setPast] = useState<EventSummary[]>([]);
  const [recruiting, setRecruiting] = useState<EventRecruitingItem[]>([]);
  const [failed, setFailed] = useState(false);

  // Best-effort, like the site's: a failure just means no banner.
  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    eventRecruiting(sessionToken)
      .then((items) => {
        if (!cancelled) setRecruiting(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  useEffect(() => {
    if (!guildId && !sessionToken) {
      setActive([]);
      return;
    }
    let cancelled = false;
    const load = (status: "draft" | "active" | "past") =>
      guildId ? guildEvents(guildId, status, sessionToken) : myEvents(status, sessionToken!);
    Promise.all([
      load("active"),
      load("past").catch(() => [] as EventSummary[]),
      // Drafts require a session (member visibility) — quietly empty without.
      sessionToken
        ? load("draft").catch(() => [] as EventSummary[])
        : Promise.resolve([] as EventSummary[]),
    ])
      .then(([a, p, u]) => {
        if (cancelled) return;
        // By date, not creation order; the 5 past events are the most
        // recently ENDED ones, so sort before slicing.
        setActive(sortEventsChronologically(a));
        setPast(sortEventsChronologically(p).slice(0, 5));
        setUpcoming(sortEventsChronologically(u));
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [guildId, sessionToken]);

  if (!guildId && !sessionToken) {
    return (
      <ErrorNote>
        Launch the activity from your clan&apos;s Discord server — or allow the Discord sign-in when
        the app opens, so we can find your clans&apos; events.
      </ErrorNote>
    );
  }
  if (failed) return <ErrorNote>Couldn&apos;t load your events.</ErrorNote>;
  if (active == null) return <LoadingBlock rows={3} />;

  return (
    <div>
      {recruiting.length > 0 && (
        <div className="mb-4">
          <EventRecruitingBanner
            items={recruiting}
            onOpenEvent={(id) => nav.push({ name: "event", id })}
          />
        </div>
      )}

      {/* Not "no events" while the recruiting banner is offering one. */}
      {active.length === 0 &&
        upcoming.length === 0 &&
        past.length === 0 &&
        recruiting.length === 0 && (
        <Card padding="p-6">
          <p className="text-osrs-gold text-center font-serif text-lg font-semibold">No events yet</p>
          <p className="text-osrs-parchment-dark/60 mt-1 text-center text-sm">
            Group admins can build a bingo or task race at www.droptracker.io — it&apos;ll appear
            here live.
          </p>
        </Card>
      )}

      {upcoming.length > 0 && (
        <div className="mb-4">
          <SectionHeading>Upcoming</SectionHeading>
          <div className="space-y-2.5">
            {upcoming.map((ev) => (
              <EventRow key={ev.id} event={ev} phase="upcoming" />
            ))}
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-2.5">
          {active.map((ev) => (
            <EventRow key={ev.id} event={ev} phase="live" />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <SectionHeading>Past events</SectionHeading>
          <div className="space-y-2.5">
            {past.map((ev) => (
              <EventRow key={ev.id} event={ev} phase="past" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
