import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { resolveRef } from "@/lib/entity-ref";
import { entityCanonical, entitySocialMetadata } from "@/lib/seo";
import { NpcProfile } from "@/components/npc-profile";

export const revalidate = 60;

type Params = Promise<{ npcId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const ref = await resolveRef("npc", (await params).npcId).catch(() => null);
  if (!ref || ref.ambiguous) return { title: "NPC" };
  const npc = await api.npcDetail(ref.id);
  if (!npc) return { title: "NPC" };
  return {
    ...entitySocialMetadata("npcs", npc.npc_id, {
      title: npc.name,
      description: `${npc.name} on DropTracker: ${npc.lifetime.loot.value_formatted} GP looted across ${npc.lifetime.drop_count.toLocaleString("en-US")} tracked drops, plus its drop table and personal best leaderboards.`,
    }),
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
    <NpcProfile
      npc={npc}
      dropTable={dropTable}
      pbBoard={pbBoard}
      nav={
        <Link
          href={"/personal-bests" as Route}
          className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
        >
          ← All bosses
        </Link>
      }
    />
  );
}
