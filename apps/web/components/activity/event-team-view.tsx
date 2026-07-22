"use client";

/**
 * Discord Activity mirror of the site's team detail page: the shared
 * `EventTeamView` (score/rank/loot header, items earned, task progress,
 * roster with contribution stats + GP, live activity) in read-only mode —
 * leadership/notification controls stay on the site, and links become
 * in-app view pushes.
 */
import { useEffect, useState } from "react";
import type { EventTeamDetail } from "@droptracker/api-types";
import { EventTeamView } from "@/components/event-team-view";
import { BackBar, ErrorNote, LoadingBlock } from "@/components/activity/bits";
import { eventTeam } from "@/lib/activity/api";
import { useActivityAuth } from "@/lib/activity/auth-context";
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
  if (!detail) {
    return (
      <div>
        <BackBar title="Team" onBack={nav.pop} />
        <LoadingBlock rows={6} />
      </div>
    );
  }

  return (
    <EventTeamView
      detail={detail}
      live={detail.event.status === "active"}
      readOnly
      onBack={nav.pop}
      onOpenPlayer={(playerId) => nav.push({ name: "player", id: playerId })}
    />
  );
}
