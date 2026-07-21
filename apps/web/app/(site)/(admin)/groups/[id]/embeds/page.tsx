import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getUser, requireGroupAdminPage } from "@/lib/auth";
import { FeatureGate } from "@/components/feature-gate";
import { EmbedEditor } from "@/components/embed-editor";

export const metadata: Metadata = { title: "Discord embeds" };

type Params = Promise<{ id: string }>;

// Access is gated by the (admin)/groups/[id] layout; the custom_embeds
// entitlement is gated here (and re-checked in the Server Action + Web API).
export default async function GroupEmbedsPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();
  await requireGroupAdminPage(groupId); // web64a: event managers only reach Events

  const [embeds, subscription, tiers, user] = await Promise.all([
    api.groupEmbeds(groupId).catch(() => null),
    api.groupSubscription(groupId).catch(() => null),
    api.subscriptionTiers().catch(() => []),
    getUser(),
  ]);

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Customize the Discord embeds the bot posts for your group&apos;s notifications — drops,
        collection log slots, personal bests, and more. Placeholders like{" "}
        <code className="text-osrs-gold-bright">{"{player_name}"}</code> are filled in when each
        notification is sent.
      </p>
      <FeatureGate
        entitlement="custom_embeds"
        subscription={subscription}
        tiers={tiers}
        groupId={groupId}
        isSuperadmin={user?.is_superadmin}
      >
        {embeds ? (
          <EmbedEditor groupId={groupId} initial={embeds} />
        ) : (
          <p className="text-osrs-parchment-dark/70 text-sm">
            Embed templates are unavailable right now — try again shortly.
          </p>
        )}
      </FeatureGate>
    </div>
  );
}
