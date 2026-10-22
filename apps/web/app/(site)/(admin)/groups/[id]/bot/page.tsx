import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getUser, requireGroupAdminPage } from "@/lib/auth";
import { FeatureGate } from "@/components/feature-gate";
import { BotProfileEditor, BotProfileLapsedNote } from "@/components/bot-profile-editor";

export const metadata: Metadata = { title: "Bot appearance" };

type Params = Promise<{ id: string }>;

// Access is gated by the (admin)/groups/[id] layout; the custom_bot_profile
// entitlement is gated here and enforced again by the Web API on every save.
export default async function GroupBotProfilePage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();
  await requireGroupAdminPage(groupId);

  const [subscription, tiers, user, profile] = await Promise.all([
    api.groupSubscription(groupId).catch(() => null),
    api.subscriptionTiers().catch(() => []),
    getUser(),
    api.groupBotProfile(groupId).catch(() => null),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-osrs-gold text-lg font-semibold">Bot appearance</h2>
        <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
          Give the DropTracker bot its own name, picture, banner and bio in your Discord server.
          Every message it posts there uses this look. Other servers are not affected.
        </p>
      </div>
      {profile && !user?.is_superadmin && <BotProfileLapsedNote groupId={groupId} profile={profile} />}
      <FeatureGate
        entitlement="custom_bot_profile"
        subscription={subscription}
        tiers={tiers}
        groupId={groupId}
        isSuperadmin={user?.is_superadmin}
      >
        {profile ? (
          <BotProfileEditor groupId={groupId} initial={profile} />
        ) : (
          <p className="text-osrs-parchment-dark/70 text-sm">
            Bot appearance settings are unavailable right now. Try again shortly.
          </p>
        )}
      </FeatureGate>
    </div>
  );
}
