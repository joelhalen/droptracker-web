import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { api } from "@/lib/api";
import { canAdminGroup, getUser } from "@/lib/auth";
import { orAccessDenied } from "@/lib/fetch";
import { EventManager } from "@/components/event-manager";
import { EventClanPanel } from "@/components/event-clan-panel";
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
    orAccessDenied(api.eventForAdmin(evId)),
    api.groupSubscription(groupId).catch(() => null),
    api.subscriptionTiers().catch(() => []),
    getUser(),
  ]);

  // web119a: a staff-hosted (global) clan-vs-clan event. Staff manage it under
  // /admin/events; a participating clan's leaders get their clan's side only.
  if (event.staff_hosted) {
    if (!(event.viewer?.managed_clan_ids ?? []).includes(groupId)) {
      if (user?.is_superadmin) redirect(`/admin/events/${evId}`);
      notFound();
    }
    return <EventClanPanel groupId={groupId} event={event} />;
  }

  // A clan challenged into a clan-vs-clan event (group_id is the HOST) co-manages
  // it without its own paid tier — only the host pays. Don't paywall them.
  const isParticipant = event.mode === "clan_vs_clan" && event.group_id !== groupId;

  const manager = (
    <div className="max-w-3xl">
      <EventManager groupId={groupId} event={event} />
    </div>
  );

  if (isParticipant) return manager;

  return (
    <FeatureGate
      entitlement="events"
      subscription={subscription}
      tiers={tiers}
      groupId={groupId}
      isSuperadmin={user?.is_superadmin}
      canUpgrade={user != null && canAdminGroup(user, groupId)}
    >
      {manager}
    </FeatureGate>
  );
}
