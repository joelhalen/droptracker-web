import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { api } from "@/lib/api";
import { orAccessDenied } from "@/lib/fetch";
import { EventDiscordSettings } from "@/components/event-discord";

export const metadata: Metadata = { title: "Event Discord settings" };

type Params = Promise<{ eventId: string }>;

// Discord settings for GLOBAL events (group_id null; superadmin-only — the
// /admin layout gates the subtree). Group events are configured on their
// group's page, which superadmins can open for any group — redirect there.
export default async function AdminEventDiscordPage({ params }: { params: Params }) {
  const { eventId } = await params;
  const evId = Number(eventId);
  if (!Number.isFinite(evId)) notFound();

  const event = await orAccessDenied(api.eventForAdmin(evId));
  if (event.group_id != null) {
    redirect(`/groups/${event.group_id}/events/${event.id}/discord`);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href={`/admin/events/${event.id}` as Route}
          className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
        >
          ← Back to event manager
        </Link>
        <h2 className="text-osrs-gold mt-1 text-xl font-bold">Discord settings</h2>
        <p className="text-osrs-parchment-dark/60 text-sm">{event.name}</p>
      </div>
      <EventDiscordSettings groupId={null} eventId={event.id} />
    </div>
  );
}
