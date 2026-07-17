import type { Metadata, Route } from "next";
import { notFound, redirect } from "next/navigation";
import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { EventCreateEntry } from "@/components/event-create-entry";

export const metadata: Metadata = { title: "New global event" };

type SearchParams = Promise<{ event?: string; step?: string }>;

// Superadmin-only (guarded by the /admin layout). Global events belong to no
// group — any player with a linked account can join.
export default async function NewGlobalEventPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { event: eventParam, step: stepParam } = await searchParams;

  let initialEvent = null;
  if (eventParam) {
    const evId = Number(eventParam);
    if (!Number.isFinite(evId)) notFound();
    initialEvent = await orNotFound(api.eventForAdmin(evId));
    if (initialEvent.status !== "draft") {
      redirect(`/admin/events/${evId}` as Route);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="heading-rule text-osrs-gold pb-1 text-lg font-semibold">
        {initialEvent ? `Set up: ${initialEvent.name}` : "New global event"}
      </h2>
      <p className="text-osrs-parchment-dark/70 text-sm">
        Global events belong to no group — any player with a linked account can join. Group events
        are created from each group&apos;s own Events tab.
      </p>
      <EventCreateEntry
        groupId={null}
        initialEvent={initialEvent}
        initialStep={Number(stepParam) || 0}
      />
    </div>
  );
}
