import type { Metadata } from "next";
import { requireGroupAdminPage } from "@/lib/auth";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { SubscriptionManager } from "@/components/subscription-manager";

export const metadata: Metadata = { title: "Subscription" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ tier?: string | string[] }>;

// Access is gated by the (admin)/groups/[id] layout.
export default async function GroupSubscriptionPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  // Optional deep-link from /premium: ?tier=<key> highlights that plan card.
  const { tier } = await searchParams;
  const groupId = Number(id);
  await requireGroupAdminPage(groupId); // web64a: event managers only reach Events
  if (!Number.isFinite(groupId)) notFound();

  const [tiers, subscription] = await Promise.all([
    api.subscriptionTiers(),
    api.groupSubscription(groupId),
  ]);

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Manage this group&apos;s recurring subscription. Billing is handled by our payment provider.
      </p>
      <SubscriptionManager
        groupId={groupId}
        tiers={tiers}
        initial={subscription}
        highlightTierKey={typeof tier === "string" ? tier : undefined}
      />
    </div>
  );
}
