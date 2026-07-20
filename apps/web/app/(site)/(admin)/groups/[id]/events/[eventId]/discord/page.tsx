import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { orAccessDenied } from "@/lib/fetch";
import { EventDiscordSettings } from "@/components/event-discord";
import { FeatureGate } from "@/components/feature-gate";

export const metadata: Metadata = { title: "Event Discord settings" };

type Params = Promise<{ id: string; eventId: string }>;

// Per-event Discord settings (channels, scheduled event, pings, message
// verbosity, live leaderboard) — split off the event manager page. Access is
// gated by the (admin)/groups/[id] layout; the paywall mirrors the manager
// page, including the clan-vs-clan participant bypass (only the host pays).
export default async function EventDiscordPage({ params }: { params: Params }) {
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

  // A clan challenged into a clan-vs-clan event (group_id is the HOST) co-manages
  // it without its own paid tier — only the host pays. Don't paywall them.
  const isParticipant = event.mode === "clan_vs_clan" && event.group_id !== groupId;

  const body = (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href={`/groups/${groupId}/events/${event.id}` as Route}
          className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
        >
          ← Back to event manager
        </Link>
        <h2 className="text-osrs-gold mt-1 text-xl font-bold">Discord settings</h2>
        <p className="text-osrs-parchment-dark/60 text-sm">{event.name}</p>
      </div>
      <EventDiscordSettings groupId={groupId} eventId={event.id} />
    </div>
  );

  if (isParticipant) return body;

  return (
    <FeatureGate
      entitlement="events"
      subscription={subscription}
      tiers={tiers}
      groupId={groupId}
      isSuperadmin={user?.is_superadmin}
    >
      {body}
    </FeatureGate>
  );
}
