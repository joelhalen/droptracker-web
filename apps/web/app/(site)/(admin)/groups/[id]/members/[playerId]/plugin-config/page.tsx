import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { requireGroupAdminPage } from "@/lib/auth";
import { PluginConfigView } from "@/components/plugin-config-view";

export const metadata: Metadata = { title: "Plugin settings" };

type Params = Promise<{ id: string; playerId: string }>;

export default async function MemberPluginConfigPage({ params }: { params: Params }) {
  const { id, playerId } = await params;
  const groupId = Number(id);
  const pid = Number(playerId);
  if (!Number.isFinite(groupId) || !Number.isFinite(pid)) notFound();
  await requireGroupAdminPage(groupId);

  const data = await api.groupMemberPluginConfig(groupId, pid);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-osrs-gold text-lg font-semibold">
          {data.player.name ?? `Player ${pid}`}: plugin settings
        </h1>
        <Link
          href={`/groups/${groupId}/members` as Route}
          className="hover:text-osrs-gold-bright text-sm"
        >
          Back to members
        </Link>
      </div>
      <PluginConfigView data={data} />
    </div>
  );
}
