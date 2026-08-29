import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { EventPlayersView } from "@/components/event-players-view";
import { CompetitionStandings } from "@/components/competition-standings";
import { isCompetitionKind } from "@/lib/competition";
import { EventPageHeader, loadEventForView } from "../_shared";

export const revalidate = 15;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  try {
    const event = await api.event(Number(id));
    return {
      title: `Players — ${event.name}`,
      description: `Player contributions and standings for ${event.name}.`,
    };
  } catch {
    return { title: "Players" };
  }
}

export default async function EventPlayersPage({ params }: { params: Params }) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) notFound();
  const user = await getUser().catch(() => null);
  const loaded = await loadEventForView(eventId, user, `/events/${eventId}/players`);
  if ("denied" in loaded) return loaded.denied;
  const { event } = loaded;

  // SOTW/BOTW (web105a): the competition leaderboard IS the players view.
  if (isCompetitionKind(event.kind)) {
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
        />
      </div>
    );
  }

  const data = user ? await api.eventPlayersAuthed(eventId) : await api.eventPlayers(eventId);

  return (
    <div className="space-y-8">
      <EventPageHeader event={event} />
      <EventPlayersView data={data} eventId={eventId} />
    </div>
  );
}
