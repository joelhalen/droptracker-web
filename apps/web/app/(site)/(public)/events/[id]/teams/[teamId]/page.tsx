import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api, ApiError, apiErrorCode } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { AccessDenied } from "@/components/access-denied";
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
  // Signed-in reads carry the session so draft (pre-publication) events stay
  // visible to members of participating clans; anonymous reads stay cached.
  const user = await getUser().catch(() => null);
  // Restricted-event denials mirror the event page (web57a): signed-in
  // outsiders get a 403 with a reason code, anonymous viewers a 404 that's
  // indistinguishable from a missing team — offered a sign-in that returns here.
  let detail;
  try {
    detail = await (user ? api.eventTeamAuthed(eventId, teamIdNum) : api.eventTeam(eventId, teamIdNum));
  } catch (err) {
    const code = apiErrorCode(err);
    if (code === "event_draft" || code === "event_private") {
      return (
        <AccessDenied
          title={code === "event_draft" ? "This event isn't live yet" : "This event is private"}
          message="This team belongs to an event that's only visible to event admins and members of participating clans. If your clan is taking part, ask a clan admin to add you to the group on DropTracker."
          back={{ href: "/events", label: "Browse events" }}
        />
      );
    }
    if (err instanceof ApiError && err.status === 404 && !user) {
      return (
        <AccessDenied
          title="Team not available"
          message="This team doesn't exist — or its event is restricted to participants. If someone shared this link with you, sign in with Discord and we'll bring you back here to check your access."
          signInReturnTo={`/events/${eventId}/teams/${teamIdNum}`}
          back={{ href: "/events", label: "Browse events" }}
        />
      );
    }
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  return <EventTeamView detail={detail} live={detail.event.status === "active"} />;
}
