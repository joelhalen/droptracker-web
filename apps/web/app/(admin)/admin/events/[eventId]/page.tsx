import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { EventManager } from "@/components/event-manager";

export const metadata: Metadata = { title: "Manage event" };

type Params = Promise<{ eventId: string }>;

// Management surface for GLOBAL events (group_id null; superadmin-only — the
// /admin layout gates the subtree). Group events are managed on their group's
// page, which superadmins can open for any group — redirect there.
export default async function AdminManageEventPage({ params }: { params: Params }) {
  const { eventId } = await params;
  const evId = Number(eventId);
  if (!Number.isFinite(evId)) notFound();

  const event = await orNotFound(api.eventForAdmin(evId));
  if (event.group_id != null) {
    redirect(`/groups/${event.group_id}/events/${event.id}`);
  }

  return (
    <div className="max-w-3xl">
      <EventManager groupId={null} event={event} />
    </div>
  );
}
