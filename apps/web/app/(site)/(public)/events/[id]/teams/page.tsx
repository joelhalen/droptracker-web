import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { EventTeamsBoard } from "@/components/event-teams-board";
import { CompetitionStandings } from "@/components/competition-standings";
import { isCompetitionKind, isTeamRace } from "@/lib/competition";
import { EventPageHeader, loadEventForView } from "../_shared";

export const revalidate = 15;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  try {
    const event = await api.event(Number(id));
    return {
      title: `Teams — ${event.name}`,
      description: `Team standings and contributions for ${event.name}.`,
    };
  } catch {
    return { title: "Teams" };
  }
}

export default async function EventTeamsIndexPage({ params }: { params: Params }) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) notFound();
  const user = await getUser().catch(() => null);
  const loaded = await loadEventForView(eventId, user, `/events/${eventId}/teams`);
  if ("denied" in loaded) return loaded.denied;
  const { event } = loaded;

  // SOTW/BOTW (web105a): an individual race has no teams surface (its one
  // roster team is scaffolding, not a competitor). A team race's teams page is
  // the race's team table, over its players.
  if (isCompetitionKind(event.kind)) {
    if (!isTeamRace(event.competition)) notFound();
    const board = await api.eventCompetition(eventId).catch(() => null);
    if (!board) notFound();
    return (
      <div className="space-y-8">
        <EventPageHeader event={event} />
        <CompetitionStandings
          eventId={eventId}
          initial={board}
          live={event.status === "active"}
          viewerPlayerIds={user?.players.map((p) => p.id) ?? []}
          viewerTeamId={event.viewer?.team_id ?? null}
        />
      </div>
    );
  }

  // Self-sufficient standings rollup: rank/score + tasks-done, pot share,
  // event-window loot GP, top task-credited items, and top contributors.
  const teamsData = user
    ? await api.eventTeamsAuthed(eventId).catch(() => null)
    : await api.eventTeams(eventId).catch(() => null);

  return (
    <div className="space-y-8">
      <EventPageHeader event={event} />
      <EventTeamsBoard
        eventId={eventId}
        kind={event.kind}
        data={teamsData}
        taskCount={event.tasks_hidden ? null : event.tasks.length}
        potEnabled={event.prize_pot?.enabled}
        viewerTeamId={event.viewer?.team_id ?? null}
      />
    </div>
  );
}
