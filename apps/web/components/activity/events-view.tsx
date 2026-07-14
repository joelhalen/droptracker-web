"use client";

/**
 * Events tab: the launch guild's active events (plus recent past ones),
 * pushing the full live event screen (board/tasks/join) on tap.
 */
import { useEffect, useState } from "react";
import type { EventSummary } from "@droptracker/api-types";
import { Card } from "@/components/ui";
import { EventWindow } from "@/components/local-time";
import { guildEvents } from "@/lib/activity/api";
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
    if (!guildId) {
      setActive([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      guildEvents(guildId, "active", sessionToken),
      guildEvents(guildId, "past", sessionToken).catch(() => [] as EventSummary[]),
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

  if (!guildId) {
    return (
      <ErrorNote>
        Events belong to clan servers — launch the activity from your clan&apos;s Discord server to
        see its boards.
      </ErrorNote>
    );
  }
  if (failed) return <ErrorNote>Couldn&apos;t load this server&apos;s events.</ErrorNote>;
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
