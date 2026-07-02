import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { EventManager } from "@/components/event-manager";

export const metadata: Metadata = { title: "Manage event" };

type Params = Promise<{ id: string; eventId: string }>;

// Access is gated by the (admin)/groups/[id] layout.
export default async function ManageEventPage({ params }: { params: Params }) {
  const { id, eventId } = await params;
  const groupId = Number(id);
  const evId = Number(eventId);
  if (!Number.isFinite(groupId) || !Number.isFinite(evId)) notFound();

  const event = await orNotFound(api.event(evId));

  return (
    <div className="max-w-3xl">
      <EventManager groupId={groupId} event={event} />
    </div>
  );
}
