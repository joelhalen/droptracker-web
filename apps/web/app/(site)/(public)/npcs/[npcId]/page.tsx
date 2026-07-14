import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { resolveRef } from "@/lib/entity-ref";
import { entityCanonical } from "@/lib/seo";
import { RecentDropsList, TopPlayersList } from "@/components/entity-activity";
import { NpcDropTableCard } from "@/components/npc-drop-table";
import { PbBoards } from "@/components/pb-boards";
import { Card, StatTile } from "@/components/ui";

export const revalidate = 60;

type Params = Promise<{ npcId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const ref = await resolveRef("npc", (await params).npcId).catch(() => null);
  if (!ref || ref.ambiguous) return { title: "NPC" };
  const npc = await api.npcDetail(ref.id);
  if (!npc) return { title: "NPC" };
  return {
    title: npc.name,
    description: `${npc.name} on DropTracker — ${npc.lifetime.loot.value_formatted} GP looted across ${npc.lifetime.drop_count.toLocaleString()} tracked drops, drop table, and personal best leaderboards.`,
    alternates: entityCanonical("npcs", npc.npc_id, npc.canonical_slug),
  };
}

export default async function NpcPage({ params }: { params: Params }) {
  const ref = await resolveRef("npc", (await params).npcId);
  // NPC names collapse to a primary id, so `ambiguous` never happens here.
  if (ref.ambiguous) notFound();
  const npcId = ref.id;

  const npc = await api.npcDetail(npcId);
  if (!npc) notFound();
  // Secondary sections are non-critical — render the page even if one fails.
  const [dropTable, pbBoard] = await Promise.all([
    api.npcDropTable(npcId),
    api.pbBoard(npcId),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href={"/personal-bests" as Route}
          className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
        >
          ← All bosses
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <img
            src={npc.icon_url}
            alt=""
            className="size-14 shrink-0 rounded object-contain"
            loading="lazy"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-osrs-gold truncate text-2xl font-bold">{npc.name}</h1>
            <p className="text-osrs-parchment-dark/70 text-sm">
              Loot, drop table &amp; personal bests ·{" "}
              <a
                href={npc.wiki_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-osrs-gold-bright hover:underline"
              >
                OSRS Wiki ↗
              </a>
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total looted" value={npc.lifetime.loot.value_formatted} hint="all time" />
        <StatTile
          label="Tracked drops"
          value={npc.lifetime.drop_count.toLocaleString()}
          hint="all time"
        />
        <StatTile
          label="Players looting"
          value={npc.lifetime.unique_players.toLocaleString()}
          hint="all time"
        />
        <StatTile
          label="This month"
          value={npc.month.loot.value_formatted}
          hint={`${npc.month.drop_count.toLocaleString()} drops · ${npc.month.unique_players.toLocaleString()} players`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          {dropTable && <NpcDropTableCard table={dropTable} />}
        </div>
        <div className="min-w-0 space-y-6">
          <Card>
            <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Top players</h2>
            <TopPlayersList rows={npc.top_players} />
          </Card>
          <Card>
            <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Recent drops</h2>
            <RecentDropsList
              rows={npc.recent_drops.map((d) => ({
                drop_id: d.drop_id,
                player_id: d.player_id,
                player_name: d.player_name,
                value: d.value,
                quantity: d.quantity,
                ts: d.ts,
                context_id: d.item_id,
                context_name: d.item_name,
                context_href: "items" as const,
                icon_url: d.icon_url,
              }))}
            />
          </Card>
        </div>
      </div>

      {pbBoard && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-osrs-gold text-lg font-semibold">Personal bests</h2>
            <span className="text-osrs-parchment-dark/60 text-xs">
              {pbBoard.player_count.toLocaleString()} ranked players ·{" "}
              {pbBoard.entry_count.toLocaleString()} recorded times
            </span>
          </div>
          <PbBoards board={pbBoard} />
        </section>
      )}
    </div>
  );
}
