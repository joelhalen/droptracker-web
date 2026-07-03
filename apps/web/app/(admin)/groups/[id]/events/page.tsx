import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { EventCreateForm } from "@/components/event-create-form";
import { FeatureGate } from "@/components/feature-gate";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Events" };

type Params = Promise<{ id: string }>;

export default async function GroupEventsPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  const [events, subscription, tiers, user] = await Promise.all([
    api.events({ groupId }),
    api.groupSubscription(groupId).catch(() => null),
    api.subscriptionTiers().catch(() => []),
    getUser(),
  ]);

  const content = (
    <div className="grid gap-10 lg:grid-cols-2">
      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">New event</h2>
        <EventCreateForm groupId={groupId} />
      </section>

      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Events</h2>
        {events.length ? (
          <ul className="divide-osrs-bronze/20 divide-y">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-3">
                <Link
                  href={`/groups/${groupId}/events/${e.id}` as Route}
                  className="hover:text-osrs-gold-bright font-medium"
                >
                  {e.name}
                </Link>
                <span className="text-osrs-parchment-dark/60 text-xs capitalize">{e.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No events yet"
            hint="Create one to add tasks, teams, and bingo boards."
          />
        )}
      </section>
    </div>
  );

  return (
    <FeatureGate
      entitlement="events"
      subscription={subscription}
      tiers={tiers}
      groupId={groupId}
      isSuperadmin={user?.is_superadmin}
    >
      {content}
    </FeatureGate>
  );
}
