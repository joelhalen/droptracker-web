"use client";

/**
 * Discord Activity mirror of the site's event Players tab: the shared
 * `EventPlayersView` (podium + GP + item strips + drill-down) wired to the
 * activity's bearer-token BFF and the in-app view stack (site links would
 * 404 inside the iframe).
 */
import { useCallback, useEffect, useState } from "react";
import type { EventPlayersResponse } from "@droptracker/api-types";
import { EventPlayersView, type PlayerDetailFetcher } from "@/components/event-players-view";
import { BackBar, ErrorNote, LoadingBlock } from "@/components/activity/bits";
import { eventPlayerDetail, eventPlayers } from "@/lib/activity/api";
import { useActivityAuth } from "@/lib/activity/auth-context";
import { useActivityNav } from "@/lib/activity/nav";

export function ActivityEventPlayersView({ eventId }: { eventId: number }) {
  const nav = useActivityNav();
  const { sessionToken } = useActivityAuth();
  const [data, setData] = useState<EventPlayersResponse | null>(null);
  const [failed, setFailed] = useState<"missing" | "error" | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(null);
    eventPlayers(eventId, sessionToken)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: { status?: number }) => {
        if (!cancelled) setFailed(err?.status === 404 ? "missing" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, sessionToken]);

  const fetchDetail: PlayerDetailFetcher = useCallback(
    (playerId) => eventPlayerDetail(eventId, playerId, sessionToken),
    [eventId, sessionToken],
  );
  const openPlayer = useCallback(
    (playerId: number) => nav.push({ name: "player", id: playerId }),
    [nav],
  );

  if (failed) {
    return (
      <div>
        <BackBar title="Players" onBack={nav.pop} />
        <ErrorNote>
          {failed === "missing" ? "This event doesn't exist." : "Couldn't load the players."}
        </ErrorNote>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <BackBar title="Players" onBack={nav.pop} />
        <LoadingBlock rows={6} />
      </div>
    );
  }

  return (
    <div>
      <BackBar title={`Players — ${data.event.name}`} onBack={nav.pop} />
      <EventPlayersView
        data={data}
        eventId={eventId}
        fetchDetail={fetchDetail}
        onOpenPlayer={openPlayer}
      />
    </div>
  );
}
