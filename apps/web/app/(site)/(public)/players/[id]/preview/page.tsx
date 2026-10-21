/**
 * Builder preview of a player's DRAFT profile layout (web137a). Rendered in
 * the profile builder's iframe. The backend only hands the draft to the
 * account that owns the player (or staff); never cached, never indexed.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { defaultPlayerLayout } from "@/lib/page-layout/catalog";
import { loadPlayerPageContext } from "@/lib/page-layout/load";
import { PlayerPageView } from "@/components/page-layout/player-page-view";
import { PreviewBridge } from "@/components/page-layout/preview-bridge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

export default async function PlayerLayoutPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isFinite(playerId)) notFound();
  await requireUser(`/players/${playerId}/preview`);
  // 403s for anyone but the owner; the error boundary shows the reason.
  const [state, ctx] = await Promise.all([
    api.layoutBuilderState("player", playerId),
    loadPlayerPageContext(playerId),
  ]);
  return (
    <>
      <PreviewBridge />
      <PlayerPageView layout={state.draft ?? defaultPlayerLayout()} ctx={ctx} preview />
    </>
  );
}
