import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { requireDeveloper } from "@/lib/auth";
import { entityPath } from "@/lib/slug";
import { PluginConfigView } from "@/components/plugin-config-view";

export const metadata: Metadata = { title: "Plugin settings" };

type Params = Promise<{ id: string }>;

export default async function StaffPluginConfigPage({ params }: { params: Params }) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isFinite(playerId)) notFound();
  await requireDeveloper(`/admin/players/${playerId}/plugin-config`);

  const data = await api.staffPlayerPluginConfig(playerId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-osrs-gold text-lg font-semibold">
          {data.player.name ?? `Player ${playerId}`}: plugin settings
        </h1>
        <Link
          href={entityPath("players", playerId, data.player.name ?? String(playerId)) as Route}
          className="hover:text-osrs-gold-bright text-sm"
        >
          View profile
        </Link>
      </div>
      <PluginConfigView data={data} />
    </div>
  );
}
