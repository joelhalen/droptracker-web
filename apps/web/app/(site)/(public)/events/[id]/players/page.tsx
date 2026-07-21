import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { EventPlayersView } from "@/components/event-players-view";
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

  const data = user ? await api.eventPlayersAuthed(eventId) : await api.eventPlayers(eventId);

  return (
    <div className="space-y-8">
      <EventPageHeader event={event} />
      <EventPlayersView data={data} eventId={eventId} />
    </div>
  );
}
