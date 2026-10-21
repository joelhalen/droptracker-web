import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { api } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { PageBuilder } from "@/components/page-builder/page-builder";

export const metadata: Metadata = { title: "Customize your profile" };
export const dynamic = "force-dynamic";

/**
 * Page builder for a player's own profile (web137a). Only the account that
 * owns the player (or staff) gets here; the Web API enforces it again.
 * Publishing needs the custom_profile Supporter perk.
 */
export default async function ProfileBuilderPage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId: raw } = await params;
  const playerId = Number(raw);
  if (!Number.isFinite(playerId)) notFound();
  const user = await requireUser(`/profile-builder/${playerId}`);
  const owned = user.players.find((p) => p.id === playerId);
  if (!owned && !user.is_superadmin) forbidden();
  const state = await api.layoutBuilderState("player", playerId);
  return (
    <PageBuilder
      scope="player"
      subjectId={playerId}
      initial={state}
      title={owned?.name ?? `Player #${playerId}`}
      previewUrl={`/players/${playerId}/preview`}
      liveUrl={`/players/${playerId}`}
      exitUrl="/dashboard"
      upgradeUrl="/premium"
    />
  );
}
