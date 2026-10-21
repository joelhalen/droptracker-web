import type { Metadata } from "next";
import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { resolveRef } from "@/lib/entity-ref";
import { entityCanonical, entitySocialMetadata } from "@/lib/seo";
import { defaultPlayerLayout } from "@/lib/page-layout/catalog";
import { loadPlayerPageContext } from "@/lib/page-layout/load";
import { EntityDisambiguation } from "@/components/entity-disambiguation";
import { PlayerPageView } from "@/components/page-layout/player-page-view";

export const revalidate = 30;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const ref = await resolveRef("player", id).catch(() => null);
  if (!ref || ref.ambiguous) return { title: "Player" };
  try {
    const player = await api.player(ref.id);
    const facts = [
      player.total_loot ? `${player.total_loot.value_formatted} GP looted this month` : null,
      player.global_rank != null ? `global rank #${player.global_rank.toLocaleString("en-US")}` : null,
    ].filter(Boolean);
    return {
      ...entitySocialMetadata("players", player.id, {
        title: player.name,
        description: facts.length
          ? `${player.name} on DropTracker: ${facts.join(", ")}.`
          : `${player.name}'s Old School RuneScape loot, personal bests and collection log on DropTracker.`,
      }),
      alternates: entityCanonical("players", player.id, player.canonical_slug),
    };
  } catch {
    return { title: "Player" };
  }
}

export default async function PlayerPage({ params }: { params: Params }) {
  const { id } = await params;
  const ref = await resolveRef("player", id);
  if (ref.ambiguous) {
    return (
      <EntityDisambiguation
        kind="players"
        slug={decodeURIComponent(id)}
        candidates={ref.candidates}
      />
    );
  }
  const playerId = ref.id;
  // 404 before anything else when the player doesn't exist.
  await orNotFound(api.player(playerId));
  // The player's own design, their clan's member layout, or the standard
  // profile: all render through the same view.
  const [chosen, ctx] = await Promise.all([
    api.playerPageLayout(playerId).catch(() => null),
    loadPlayerPageContext(playerId),
  ]);
  const { player } = ctx;

  // JSON-LD for richer search results (FRONTEND_PLAN.md §15 SEO).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: player.name,
    identifier: player.id,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PlayerPageView layout={chosen?.layout ?? defaultPlayerLayout()} ctx={ctx} />
    </>
  );
}
