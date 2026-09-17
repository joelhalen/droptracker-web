"use client";

/**
 * Discord Activity mirror of the site's event Teams tab: the shared
 * `EventTeamsBoard` (rank, score, loot GP, tasks meter, pot share, items
 * earned, top contributors) wired to the activity's bearer-token BFF, with its
 * links swapped for in-app view pushes (site routes would 404 in the iframe).
 *
 * The standings rollup carries the event summary but not the viewer's team or
 * the hidden-board signal, so the event detail is read alongside it — the same
 * two reads the site's Teams page combines.
 */
import { useCallback, useEffect, useState } from "react";
import type { EventDetail, EventTeamsResponse } from "@droptracker/api-types";
import { EventTeamsBoard } from "@/components/event-teams-board";
import { BackBar, ErrorNote, LoadingBlock } from "@/components/activity/bits";
import { ActivityCompetitionBoard } from "@/components/activity/competition-board";
import { isCompetitionKind, isTeamRace } from "@/lib/competition";
import { eventDetail, eventTeams } from "@/lib/activity/api";
import { useActivityAuth } from "@/lib/activity/auth-context";
import { useActivityNav } from "@/lib/activity/nav";

export function ActivityEventTeamsView({ eventId }: { eventId: number }) {
  const nav = useActivityNav();
  const { sessionToken } = useActivityAuth();
  const [loaded, setLoaded] = useState<{ teams: EventTeamsResponse; event: EventDetail } | null>(
    null,
  );
  const [failed, setFailed] = useState<"missing" | "error" | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setFailed(null);
    Promise.all([eventTeams(eventId, sessionToken), eventDetail(eventId, sessionToken)])
      .then(([teams, event]) => {
        if (!cancelled) setLoaded({ teams, event });
      })
      .catch((err: { status?: number }) => {
        if (!cancelled) setFailed(err?.status === 404 ? "missing" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, sessionToken]);

  const openTeam = useCallback(
    (teamId: number) => nav.push({ name: "event-team", id: eventId, teamId }),
    [nav, eventId],
  );
  const openPlayer = useCallback(
    (playerId: number) => nav.push({ name: "player", id: playerId }),
    [nav],
  );

  if (failed) {
    return (
      <div>
        <BackBar title="Teams" onBack={nav.pop} />
        <ErrorNote>
          {failed === "missing" ? "This event doesn't exist." : "Couldn't load the teams."}
        </ErrorNote>
      </div>
    );
  }
  if (!loaded) {
    return (
      <div>
        <BackBar title="Teams" onBack={nav.pop} />
        <LoadingBlock rows={4} />
      </div>
    );
  }

  const { teams, event } = loaded;
  // SOTW/BOTW: a team race's teams live on its race board; an individual race
  // has no teams to show.
  if (isCompetitionKind(event.kind)) {
    return (
      <div>
        <BackBar title={`Teams — ${event.name}`} onBack={nav.pop} />
        {isTeamRace(event.competition) ? (
          <ActivityCompetitionBoard
            eventId={eventId}
            live={event.status === "active"}
            viewerTeamId={event.viewer?.team_id ?? null}
            viewerPlayerIds={event.viewer?.player_ids_on_event ?? []}
            showRules={false}
          />
        ) : (
          <ErrorNote>This race is every player for themselves — there are no teams.</ErrorNote>
        )}
      </div>
    );
  }
  return (
    <div>
      <BackBar title={`Teams — ${event.name}`} onBack={nav.pop} />
      <EventTeamsBoard
        eventId={eventId}
        kind={event.kind}
        data={teams}
        // Hidden board (web112a): the meter's total is the number withheld.
        taskCount={event.tasks_hidden ? null : event.tasks.length}
        potEnabled={event.prize_pot?.enabled}
        viewerTeamId={event.viewer?.team_id ?? null}
        onOpenTeam={openTeam}
        onOpenPlayer={openPlayer}
      />
    </div>
  );
}
