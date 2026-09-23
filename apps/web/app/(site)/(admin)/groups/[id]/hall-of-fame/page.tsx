import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getUser, requireGroupAdminPage } from "@/lib/auth";
import { FeatureGate } from "@/components/feature-gate";
import { HofLayoutEditor } from "@/components/hof-layout-editor";

export const metadata: Metadata = { title: "Hall of Fame layout" };

type Params = Promise<{ id: string }>;

// Access is gated by the (admin)/groups/[id] layout; the hall_of_fame
// entitlement is gated here (and re-checked in the Server Action + Web API).
export default async function GroupHallOfFamePage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();
  await requireGroupAdminPage(groupId);

  const [subscription, tiers, user, layout, meta] = await Promise.all([
    api.groupSubscription(groupId).catch(() => null),
    api.subscriptionTiers().catch(() => []),
    getUser(),
    api.groupHofLayout(groupId).catch(() => null),
    api.hofLayoutMeta().catch(() => null),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-osrs-gold text-lg font-semibold">Hall of Fame layout</h2>
        <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
          Design the message the bot keeps for each boss in your Hall of Fame channel: who has the
          highest kill count, who has looted the most, the fastest personal bests, and anything else
          you want to say, with boss and coin icons. Which bosses appear, the channel and the number
          of personal bests are set in{" "}
          <Link href={`/groups/${groupId}/settings`} className="text-osrs-gold-bright underline">
            Settings
          </Link>
          .
        </p>
      </div>
      <FeatureGate
        entitlement="hall_of_fame"
        subscription={subscription}
        tiers={tiers}
        groupId={groupId}
        isSuperadmin={user?.is_superadmin}
      >
        {layout && meta ? (
          <HofLayoutEditor groupId={groupId} initial={layout} meta={meta} />
        ) : (
          <p className="text-osrs-parchment-dark/70 text-sm">
            The Hall of Fame layout editor is unavailable right now. Try again shortly.
          </p>
        )}
      </FeatureGate>
    </div>
  );
}
