import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { EventTeamsBoard } from "@/components/event-teams-board";
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

  // Top-contributor chips per team come from the event-wide player rollup.
  const playersData = user
    ? await api.eventPlayersAuthed(eventId).catch(() => null)
    : await api.eventPlayers(eventId).catch(() => null);

  return (
    <div className="space-y-8">
      <EventPageHeader event={event} />
      <EventTeamsBoard
        eventId={eventId}
        teams={event.teams}
        progress={event.progress}
        taskCount={event.tasks.length}
        players={playersData?.players ?? []}
        potEnabled={event.prize_pot?.enabled}
        viewerTeamId={event.viewer?.team_id ?? null}
      />
    </div>
  );
}
