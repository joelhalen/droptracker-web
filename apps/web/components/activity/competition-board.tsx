"use client";

/**
 * Discord Activity mount for a SOTW/BOTW race: the site's race components
 * (top strip, "how it's scored" card, standings with the team table on a team
 * race) wired to the Activity's bearer-token BFF and view stack. Loads its own
 * board and reloads it whenever `refreshKey` moves (the event view's poll
 * fallback); the standings also refetch themselves on live SSE frames.
 */
import { useCallback, useEffect, useState } from "react";
import type { CompetitionPlayerDetail, EventCompetitionBoard } from "@droptracker/api-types";
import { CompetitionBonusRulesCard } from "@/components/competition-bonus-rules-card";
import { CompetitionStandings, CompetitionTopStrip } from "@/components/competition-standings";
import { competitionBoard, competitionPlayer } from "@/lib/activity/api";
import { useActivityAuth } from "@/lib/activity/auth-context";
import { openExternal } from "@/lib/activity/discord-sdk";
import { useActivityNav } from "@/lib/activity/nav";

export function useCompetitionTransports(eventId: number) {
  const { sessionToken } = useActivityAuth();
  const nav = useActivityNav();
  const fetchBoard = useCallback(
    (): Promise<EventCompetitionBoard | null> => competitionBoard(eventId, sessionToken),
    [eventId, sessionToken],
  );
  const fetchPlayer = useCallback(
    (playerId: number): Promise<CompetitionPlayerDetail | null> =>
      competitionPlayer(eventId, playerId, sessionToken),
    [eventId, sessionToken],
  );
  const onOpenPlayer = useCallback(
    (playerId: number) => nav.push({ name: "player", id: playerId }),
    [nav],
  );
  const onOpenTeam = useCallback(
    (teamId: number) => nav.push({ name: "event-team", id: eventId, teamId }),
    [nav, eventId],
  );
  return { fetchBoard, fetchPlayer, onOpenPlayer, onOpenTeam };
}

export function ActivityCompetitionBoard({
  eventId,
  live,
  refreshKey = 0,
  viewerPlayerIds = [],
  viewerTeamId = null,
  showRules = true,
}: {
  eventId: number;
  live: boolean;
  refreshKey?: number;
  viewerPlayerIds?: number[];
  viewerTeamId?: number | null;
  /** The event screen shows the scoring card; the pushed standings views don't. */
  showRules?: boolean;
}) {
  const transports = useCompetitionTransports(eventId);
  const { fetchBoard } = transports;
  const [board, setBoard] = useState<EventCompetitionBoard | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchBoard()
      .then((b) => {
        if (!cancelled && b) {
          setBoard(b);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchBoard, refreshKey]);

  if (!board) {
    return failed ? (
      <p className="text-osrs-parchment-dark/60 text-sm">Couldn&apos;t load the race standings.</p>
    ) : (
      <p className="text-osrs-parchment-dark/50 text-sm">Loading the race…</p>
    );
  }
  return (
    <div className="space-y-4">
      <CompetitionTopStrip board={board} />
      {showRules && (
        <CompetitionBonusRulesCard board={board} openLink={(url) => void openExternal(url)} />
      )}
      <div>
        <h2 className="heading-rule text-osrs-gold mb-2 pb-1 text-base font-semibold">Standings</h2>
        <CompetitionStandings
          eventId={eventId}
          initial={board}
          live={live}
          viewerPlayerIds={viewerPlayerIds}
          viewerTeamId={viewerTeamId}
          {...transports}
        />
      </div>
    </div>
  );
}
