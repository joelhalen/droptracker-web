import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { EventTeamView } from "@/components/event-team-view";

export const revalidate = 15;

type Params = Promise<{ id: string; teamId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, teamId } = await params;
  try {
    const detail = await api.eventTeam(Number(id), Number(teamId));
    return {
      title: `${detail.team.name} — ${detail.event.name}`,
      description: `Team progress, roster and activity for ${detail.team.name} in ${detail.event.name}.`,
    };
  } catch {
    return { title: "Team" };
  }
}

export default async function EventTeamPage({ params }: { params: Params }) {
  const { id, teamId } = await params;
  const eventId = Number(id);
  const teamIdNum = Number(teamId);
  if (!Number.isFinite(eventId) || !Number.isFinite(teamIdNum)) notFound();
  const detail = await orNotFound(api.eventTeam(eventId, teamIdNum));
  return <EventTeamView detail={detail} live={detail.event.status === "active"} />;
}
