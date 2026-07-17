import type { Metadata, Route } from "next";
import { notFound, redirect } from "next/navigation";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { orNotFound } from "@/lib/fetch";
import { EventCreateEntry } from "@/components/event-create-entry";
import { FeatureGate } from "@/components/feature-gate";

export const metadata: Metadata = { title: "New event" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ event?: string; step?: string }>;

// Access is gated by the (admin)/groups/[id] layout; ?event={id} resumes an
// existing draft in the wizard.
export default async function NewEventPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();
  const { event: eventParam, step: stepParam } = await searchParams;

  const [subscription, tiers, user] = await Promise.all([
    api.groupSubscription(groupId).catch(() => null),
    api.subscriptionTiers().catch(() => []),
    getUser(),
  ]);

  let initialEvent = null;
  if (eventParam) {
    const evId = Number(eventParam);
    if (!Number.isFinite(evId)) notFound();
    initialEvent = await orNotFound(api.eventForAdmin(evId));
    // Only drafts run through guided setup — anything live is managed.
    if (initialEvent.status !== "draft") {
      redirect(`/groups/${groupId}/events/${evId}` as Route);
    }
  }

  return (
    <FeatureGate
      entitlement="events"
      subscription={subscription}
      tiers={tiers}
      groupId={groupId}
      isSuperadmin={user?.is_superadmin}
    >
      <div className="max-w-3xl space-y-4">
        <h2 className="heading-rule text-osrs-gold pb-1 text-lg font-semibold">
          {initialEvent ? `Set up: ${initialEvent.name}` : "New event"}
        </h2>
        <EventCreateEntry
          groupId={groupId}
          initialEvent={initialEvent}
          initialStep={Number(stepParam) || 0}
        />
      </div>
    </FeatureGate>
  );
}
