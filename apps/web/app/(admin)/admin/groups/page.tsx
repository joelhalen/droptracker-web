import type { Metadata } from "next";
import { api } from "@/lib/api";
import { GroupPicker } from "@/components/admin/group-picker";
import { GroupCompPanel } from "@/components/admin/group-comp-panel";

export const metadata: Metadata = { title: "Groups" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ groupId?: string }>;

export default async function AdminGroupsPage({ searchParams }: { searchParams: SearchParams }) {
  const { groupId: rawId } = await searchParams;
  const groupId = rawId ? Number(rawId) : NaN;
  const hasGroup = Number.isFinite(groupId) && groupId > 0;

  let overview: Awaited<ReturnType<typeof api.adminGroupOverview>> | null = null;
  let tiers: Awaited<ReturnType<typeof api.subscriptionTiers>> = [];
  let error: string | null = null;

  if (hasGroup) {
    try {
      [overview, tiers] = await Promise.all([
        api.adminGroupOverview(groupId),
        api.subscriptionTiers(),
      ]);
    } catch (e) {
      error = (e as Error).message || "Failed to load group.";
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-osrs-parchment-dark/70 text-sm">
        Look up a group to introspect its status and grant or revoke a free, time-boxed (comped)
        subscription.
      </p>

      <GroupPicker initial={hasGroup ? String(groupId) : ""} />

      {!hasGroup ? (
        <div className="border-osrs-bronze/20 text-osrs-parchment-dark/60 rounded border p-6 text-center text-sm">
          Search for a group above to begin.
        </div>
      ) : error ? (
        <div className="border-osrs-red/40 bg-osrs-red/10 text-osrs-red rounded border p-4 text-sm">
          {error}
        </div>
      ) : overview ? (
        <GroupCompPanel overview={overview} tiers={tiers} />
      ) : null}
    </div>
  );
}
