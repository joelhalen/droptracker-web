"use client";

/**
 * Events tab: the launch guild's active events (plus recent past ones),
 * pushing the full live event screen (board/tasks/join) on tap. Launched
 * without a guild (an Activity Link opened from a DM), it falls back to the
 * session user's events across every group they belong to.
 */
import { useEffect, useState } from "react";
import type { EventSummary } from "@droptracker/api-types";
import { Card } from "@/components/ui";
import { EventWindow } from "@/components/local-time";
import { guildEvents, myEvents } from "@/lib/activity/api";
import { useActivityAuth } from "@/lib/activity/auth-context";
import { useActivityData } from "@/lib/activity/data-context";
import { useActivityNav } from "@/lib/activity/nav";
import { ErrorNote, LoadingBlock, SectionHeading } from "@/components/activity/bits";

function EventRow({ event, live }: { event: EventSummary; live: boolean }) {
  const nav = useActivityNav();
  return (
    <button
      onClick={() => nav.push({ name: "event", id: event.id })}
      className="border-osrs-bronze/30 bg-osrs-surface-1 hover:border-osrs-bronze/60 w-full rounded-2xl border p-3.5 text-left transition-colors"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-osrs-gold truncate font-serif text-[15px] font-semibold">{event.name}</span>
        {live ? (
          <span className="text-osrs-green shrink-0 text-[10px] font-bold tracking-wider uppercase">● Live</span>
        ) : (
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
    </button>
  );
}

export function EventsView() {
  const { guildId } = useActivityData();
  const { sessionToken } = useActivityAuth();
  const [active, setActive] = useState<EventSummary[] | null>(null);
  const [past, setPast] = useState<EventSummary[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!guildId && !sessionToken) {
      setActive([]);
      return;
    }
    let cancelled = false;
    const load = (status: "active" | "past") =>
      guildId ? guildEvents(guildId, status, sessionToken) : myEvents(status, sessionToken!);
    Promise.all([
      load("active"),
      load("past").catch(() => [] as EventSummary[]),
    ])
      .then(([a, p]) => {
        if (cancelled) return;
        setActive(a);
        setPast(p.slice(0, 5));
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
      {active.length === 0 && past.length === 0 && (
        <Card padding="p-6">
          <p className="text-osrs-gold text-center font-serif text-lg font-semibold">No events yet</p>
          <p className="text-osrs-parchment-dark/60 mt-1 text-center text-sm">
            Group admins can build a bingo or task race at www.droptracker.io — it&apos;ll appear
            here live.
          </p>
        </Card>
      )}

      {active.length > 0 && (
        <div className="space-y-2.5">
          {active.map((ev) => (
            <EventRow key={ev.id} event={ev} live />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <SectionHeading>Past events</SectionHeading>
          <div className="space-y-2.5">
            {past.map((ev) => (
              <EventRow key={ev.id} event={ev} live={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
