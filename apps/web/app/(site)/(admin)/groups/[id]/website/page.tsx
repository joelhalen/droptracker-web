import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { requireGroupAdminPage } from "@/lib/auth";
import { SiteBuilder } from "@/components/site-builder/site-builder";

export const metadata: Metadata = { title: "Website" };

type Params = Promise<{ id: string }>;

// Access is gated by the (admin)/groups/[id] layout. The tab itself is open
// to every group — claiming an address and pointing it somewhere is free —
// and the custom_site entitlement gates only the builder half, inside
// SiteBuilder (re-checked in the Server Actions + Web API).
export default async function GroupWebsitePage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();
  await requireGroupAdminPage(groupId);

  // Tiers drive the "available on X and above" upsell copy; whether THIS
  // group may build comes from the API (it applies the superadmin bypass).
  const tiers = await api.subscriptionTiers().catch(() => []);
  const [siteState, meta, group] = await Promise.all([
    api.groupSite(groupId).catch(() => null),
    api.siteMeta(groupId).catch(() => null),
    // Public profile payload — feeds the editor canvas's live previews.
    api.group(groupId).catch(() => null),
  ]);

  return meta && group ? (
    <SiteBuilder
      groupId={groupId}
      initialSite={siteState?.site ?? null}
      meta={meta}
      group={group}
      /* Redirect modes are free for every group; the builder half is what the
         custom_site entitlement gates, so the upsell lives inside the tab
         rather than replacing it. */
      canBuild={siteState?.can_build ?? false}
      tiers={tiers}
    />
  ) : (
    <p className="text-osrs-parchment-dark/70">Couldn&apos;t load the site builder.</p>
  );
}
