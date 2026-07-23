import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { SiteGroupSetup } from "@/components/setup/group-setup-site";

export const metadata: Metadata = { title: "Create a group" };

export default async function NewGroupPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; step?: string }>;
}) {
  await requireUser("/groups/new");
  // Resume support: the wizard stamps ?group&step after the group is created
  // so a refresh/remount drops back into the configuration steps.
  const params = await searchParams;
  const groupId = params.group ? Number(params.group) : null;
  const step = params.step ? Number(params.step) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-osrs-gold text-2xl font-bold">Create a group</h1>
        <p className="text-osrs-parchment-dark/70 text-sm">
          Connect your Discord server, link your Wise Old Man group, and go live — we&apos;ll walk
          you through it.
        </p>
      </div>
      <SiteGroupSetup
        initialGroupId={Number.isFinite(groupId) && groupId ? groupId : null}
        initialStep={Number.isFinite(step) ? step : 0}
      />
    </div>
  );
}
