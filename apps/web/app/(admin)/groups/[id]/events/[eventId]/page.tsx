import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { orNotFound } from "@/lib/fetch";
import { EventManager } from "@/components/event-manager";
import { FeatureGate } from "@/components/feature-gate";

export const metadata: Metadata = { title: "Manage event" };

type Params = Promise<{ id: string; eventId: string }>;

// Access is gated by the (admin)/groups/[id] layout.
export default async function ManageEventPage({ params }: { params: Params }) {
  const { id, eventId } = await params;
  const groupId = Number(id);
  const evId = Number(eventId);
  if (!Number.isFinite(groupId) || !Number.isFinite(evId)) notFound();

  const [event, subscription, tiers, user] = await Promise.all([
    orNotFound(api.event(evId)),
    api.groupSubscription(groupId).catch(() => null),
    api.subscriptionTiers().catch(() => []),
    getUser(),
  ]);

  return (
    <FeatureGate
      entitlement="events"
      subscription={subscription}
      tiers={tiers}
      groupId={groupId}
      isSuperadmin={user?.is_superadmin}
    >
      <div className="max-w-3xl">
        <EventManager groupId={groupId} event={event} />
      </div>
    </FeatureGate>
  );
}
