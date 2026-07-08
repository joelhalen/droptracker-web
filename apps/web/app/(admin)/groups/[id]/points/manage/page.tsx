import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { PointsManager } from "@/components/points-manager";

type Params = Promise<{ id: string }>;

export const metadata = { title: "Points" };

export default async function GroupPointsPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  // Layout guards admin access. Reads work without the entitlement so a lapsed
  // group can still see (but not edit) its configuration and history.
  const [settings, mods, lists, boosts, history] = await Promise.all([
    api.groupPointsSettings(groupId),
    api.groupPointMods(groupId),
    api.groupPointLists(groupId),
    api.groupPointBoosts(groupId),
    api.groupPointsHistory(groupId, { limit: 25 }),
  ]);

  return (
    <PointsManager
      groupId={groupId}
      initialSettings={settings}
      initialMods={mods}
      initialLists={lists}
      initialBoosts={boosts}
      initialHistory={history}
    />
  );
}
