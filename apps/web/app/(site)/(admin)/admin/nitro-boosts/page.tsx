import type { Metadata } from "next";
import { api } from "@/lib/api";
import { NitroBoostsManager } from "@/components/admin/nitro-boosts-manager";

export const metadata: Metadata = { title: "Nitro boosts" };
export const dynamic = "force-dynamic";

export default async function AdminNitroBoostsPage() {
  const data = await api.adminNitroBoosts();

  return (
    <div>
      <p className="text-osrs-parchment-dark/70 mb-6 text-sm">
        Each Nitro boost on the DropTracker Discord adds premium pool credit to one of the
        booster&apos;s clans. Discord never tells us how many boosts a member placed — we infer it
        from their boost announcement and check it against the server&apos;s total, so slots that
        can&apos;t be traced to anyone are left uncredited until you assign them here.
      </p>
      <NitroBoostsManager data={data} />
    </div>
  );
}
