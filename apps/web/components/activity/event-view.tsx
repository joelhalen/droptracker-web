"use client";

/**
 * The activity's event screen: live bingo board + team standings + task list,
 * composed from the same components the website's event page uses.
 *
 * Realtime rides the same anonymous `event:{id}` SSE scope as the site (the
 * board and progress bars subscribe themselves). Discord's proxy is expected
 * to pass SSE through, but it isn't contractual — so this view watches the
 * stream's connection state and, if it can't stay open, silently re-fetches
 * the event every 30s and remounts the board with fresh completions.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { EventDetail, Me } from "@droptracker/api-types";
import { BingoBoard } from "@/components/bingo-board";
import { EventJoinPanel } from "@/components/event-join-panel";
import { EventTaskBoard } from "@/components/event-task-progress";
import { EventWindow } from "@/components/local-time";
import { useEventStream } from "@/lib/use-event-stream";
import { teamColorMap } from "@/lib/events";
import { useActivityAuth } from "@/lib/activity/auth-context";
import { activityMe, eventDetail, joinEvent, leaveEvent } from "@/lib/activity/api";

const STATUS_STYLES: Record<string, string> = {
  draft: "text-osrs-parchment-dark/60",
  active: "text-osrs-green",
  past: "text-osrs-parchment-dark/60",
};

/** Start polling when the stream hasn't been open for this long. */
const STREAM_GRACE_MS = 20_000;
const POLL_INTERVAL_MS = 30_000;

export function EventView({
  eventId,
  guildId: _guildId,
  onBack,
}: {
  eventId: number;
  guildId: string | null;
  onBack?: (() => void) | null;
}) {
  const { sessionToken, user } = useActivityAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped on each poll refetch — remounts the board/task list so their
  // internal live-patched state reseeds from the fresh payload.
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(
    async (isRefresh: boolean) => {
      try {
        const detail = await eventDetail(eventId, sessionToken);
        setEvent(detail);
        setError(null);
        if (isRefresh) setRefreshKey((k) => k + 1);
      } catch {
        if (!isRefresh) setError("Couldn't load this event.");
      }
    },
    [eventId, sessionToken],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  // Linked players + groups for the join panel (session holders only).
  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    activityMe(sessionToken)
      .then((m) => {
        if (!cancelled) setMe(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  const live = event?.status === "active";

  // Watch stream health on the same channel the board subscribes to; fall
  // back to polling while it can't stay open (e.g. the proxy buffers SSE).
  const { state: streamState } = useEventStream(live ? [`event:${eventId}`] : [], () => {});
  const streamOpenRef = useRef(streamState);
  streamOpenRef.current = streamState;

  useEffect(() => {
    if (!live) return;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    const graceTimer = setTimeout(() => {
      if (streamOpenRef.current === "open") return;
      pollTimer = setInterval(() => {
        if (streamOpenRef.current === "open") return;
        void load(true);
      }, POLL_INTERVAL_MS);
    }, STREAM_GRACE_MS);
    return () => {
      clearTimeout(graceTimer);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [live, load]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <p className="text-osrs-parchment-dark/80 text-sm">{error}</p>
      </div>
    );
  }
  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span
          aria-hidden
          className="border-osrs-bronze/40 border-t-osrs-gold size-8 animate-spin rounded-full border-2"
        />
      </div>
    );
  }

  const standings = [...event.teams].sort((a, b) => b.score - a.score);
  const teamColor = teamColorMap(event.teams);
  const teamRefs = event.teams.map((t) => ({ id: t.id, name: t.name, color: t.color }));

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-3 py-4">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
            >
              ←
            </button>
          )}
          <h1 className="text-osrs-gold text-xl font-bold">{event.name}</h1>
          <span className={`text-xs capitalize ${STATUS_STYLES[event.status] ?? ""}`}>
            ● {event.status}
          </span>
        </div>
        <p className="text-osrs-parchment-dark/60 text-xs">
          <EventWindow startsAt={event.starts_at} endsAt={event.ends_at} status={event.status} />
        </p>
        {user && (
          <p className="text-osrs-parchment-dark/50 text-xs">
            Viewing as {user.global_name ?? user.username}
          </p>
        )}
      </header>

      {standings.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {standings.map((t, i) => (
            <span
              key={t.id}
              className="border-osrs-bronze/30 bg-osrs-brown-dark/40 inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs"
            >
              <span className="text-osrs-parchment-dark/50">#{i + 1}</span>
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: teamColor.get(t.id) }}
                aria-hidden
              />
              <span
                className={
                  t.id === event.viewer?.team_id
                    ? "text-osrs-gold-bright font-medium"
                    : "text-osrs-parchment-dark/85"
                }
              >
                {t.name}
              </span>
              <span className="text-osrs-gold tabular-nums">{t.score.toLocaleString()}</span>
            </span>
          ))}
        </div>
      )}

      {event.status !== "past" && (
        <div className="border-osrs-bronze/20 bg-osrs-brown-dark/30 rounded border p-3">
          <h2 className="text-osrs-gold mb-2 text-sm font-semibold">Participate</h2>
          {sessionToken ? (
            <EventJoinPanel
              event={event}
              players={me ? me.players.map((p) => ({ id: p.id, name: p.name })) : []}
              viewerGroupIds={me?.groups.map((g) => g.id) ?? []}
              join={(eventId, input) => joinEvent(eventId, input, sessionToken)}
              leave={(eventId, playerId) => leaveEvent(eventId, playerId, sessionToken)}
              onChanged={() => void load(true)}
            />
          ) : (
            <p className="text-osrs-parchment-dark/60 text-sm">
              Approve the Discord sign-in prompt when launching the activity to join this event.
            </p>
          )}
        </div>
      )}

      {event.bingo && (
        <BingoBoard
          key={`board-${refreshKey}`}
          board={event.bingo}
          teams={teamRefs}
          tasks={event.tasks}
          eventId={event.id}
          live={live}
          progress={event.progress}
          viewerTeamId={event.viewer?.team_id}
        />
      )}

      {event.tasks.length > 0 && (
        <div>
          <h2 className="heading-rule text-osrs-gold mb-2 pb-1 text-base font-semibold">Tasks</h2>
          <EventTaskBoard
            key={`tasks-${refreshKey}`}
            tasks={event.tasks}
            teams={teamRefs}
            progress={event.progress}
            eventId={event.id}
            live={live}
            viewerTeamId={event.viewer?.team_id}
          />
        </div>
      )}
    </div>
  );
}
