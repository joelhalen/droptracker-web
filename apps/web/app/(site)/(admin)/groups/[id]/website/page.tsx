import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getUser, requireGroupAdminPage } from "@/lib/auth";
import { FeatureGate } from "@/components/feature-gate";
import { SiteBuilder } from "@/components/site-builder/site-builder";

export const metadata: Metadata = { title: "Website" };

type Params = Promise<{ id: string }>;

// Access is gated by the (admin)/groups/[id] layout; the custom_site
// entitlement is gated here (and re-checked in the Server Actions + Web API).
export default async function GroupWebsitePage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();
  await requireGroupAdminPage(groupId);

  const [subscription, tiers, user] = await Promise.all([
    api.groupSubscription(groupId).catch(() => null),
    api.subscriptionTiers().catch(() => []),
    getUser(),
  ]);
  const [siteState, meta] = await Promise.all([
    api.groupSite(groupId).catch(() => null),
    api.siteMeta(groupId).catch(() => null),
  ]);

  return (
    <FeatureGate
      entitlement="custom_site"
      subscription={subscription}
      tiers={tiers}
      groupId={groupId}
      isSuperadmin={user?.is_superadmin ?? false}
    >
      {meta ? (
        <SiteBuilder
          groupId={groupId}
          initialSite={siteState?.site ?? null}
          meta={meta}
        />
      ) : (
        <p className="text-osrs-parchment-dark/70">Couldn&apos;t load the site builder.</p>
      )}
    </FeatureGate>
  );
}
