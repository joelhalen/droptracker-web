"use client";

/**
 * Discord Activity mirror of the site's team detail page: the shared
 * `EventTeamView` (score/rank/loot header, items earned, task progress,
 * roster with contribution stats + GP, submission log) in read-only mode —
 * leadership/notification controls stay on the site, and links become
 * in-app view pushes.
 */
import { useCallback, useEffect, useState } from "react";
import type { EventCompetitionBoard, EventTeamDetail } from "@droptracker/api-types";
import { EventTeamView } from "@/components/event-team-view";
import { CompetitionTeamView } from "@/components/competition-team-view";
import { useCompetitionTransports } from "@/components/activity/competition-board";
import { BackBar, ErrorNote, LoadingBlock } from "@/components/activity/bits";
import { eventTeam, eventTeamContributions } from "@/lib/activity/api";
import { isCompetitionKind } from "@/lib/competition";
import { useActivityAuth } from "@/lib/activity/auth-context";
import { openExternal } from "@/lib/activity/discord-sdk";
import { useActivityNav } from "@/lib/activity/nav";

export function ActivityEventTeamView({
  eventId,
  teamId,
}: {
  eventId: number;
  teamId: number;
}) {
  const nav = useActivityNav();
  const { sessionToken } = useActivityAuth();
  const [detail, setDetail] = useState<EventTeamDetail | null>(null);
  const [failed, setFailed] = useState<"missing" | "error" | null>(null);
  // SOTW/BOTW: a race team's page is the race (its board is loaded too).
  const race = useCompetitionTransports(eventId);
  const { fetchBoard: fetchRaceBoard } = race;
  const [board, setBoard] = useState<EventCompetitionBoard | null>(null);
  const isRace = detail != null && isCompetitionKind(detail.event.kind);
  useEffect(() => {
    if (!isRace) return;
    let cancelled = false;
    fetchRaceBoard()
      .then((b) => {
        if (!cancelled) setBoard(b);
      })
      .catch(() => {
        if (!cancelled) setFailed("error");
      });
    return () => {
      cancelled = true;
    };
  }, [isRace, fetchRaceBoard]);

  // The submission log paginates on its own, through the bearer-authed
  // activity BFF (the shared view's default cookie fetch can't work here).
  const loadContributions = useCallback(
    (page: number) => eventTeamContributions(eventId, teamId, page, sessionToken),
    [eventId, teamId, sessionToken],
  );

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setFailed(null);
    eventTeam(eventId, teamId, sessionToken)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err: { status?: number }) => {
        if (!cancelled) setFailed(err?.status === 404 ? "missing" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, teamId, sessionToken]);

  if (failed) {
    return (
      <div>
        <BackBar title="Team" onBack={nav.pop} />
        <ErrorNote>
          {failed === "missing" ? "This team doesn't exist." : "Couldn't load this team."}
        </ErrorNote>
      </div>
    );
  }
  if (!detail || (isRace && !board)) {
    return (
      <div>
        <BackBar title="Team" onBack={nav.pop} />
        <LoadingBlock rows={6} />
      </div>
    );
  }
  if (isRace && board) {
    return (
      <CompetitionTeamView
        detail={detail}
        board={board}
        live={detail.event.status === "active"}
        onBack={nav.pop}
        onOpenPlayer={race.onOpenPlayer}
        fetchBoard={race.fetchBoard}
        fetchPlayer={race.fetchPlayer}
      />
    );
  }

  return (
    <EventTeamView
      detail={detail}
      live={detail.event.status === "active"}
      readOnly
      onBack={nav.pop}
      onOpenPlayer={(playerId) => nav.push({ name: "player", id: playerId })}
      loadContributions={loadContributions}
      openLink={(url) => void openExternal(url)}
    />
  );
}
