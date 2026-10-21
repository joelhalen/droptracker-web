/**
 * Builder preview of a group's DRAFT layout (web137a). Rendered inside the
 * page builder's iframe: the real page, real data, the saved draft. Group
 * admins only; never cached, never indexed.
 *
 * `?for=members` previews the member profile layout on one member's profile
 * (`&player=<id>`, else the group's top player).
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { requireGroupAdminPage } from "@/lib/auth";
import { orNotFound } from "@/lib/fetch";
import { defaultGroupLayout, defaultPlayerLayout } from "@/lib/page-layout/catalog";
import { loadGroupPageContext, loadPlayerPageContext } from "@/lib/page-layout/load";
import { GroupPageView } from "@/components/page-layout/group-page-view";
import { PlayerPageView } from "@/components/page-layout/player-page-view";
import { PreviewBridge } from "@/components/page-layout/preview-bridge";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

export default async function GroupLayoutPreview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ for?: string; player?: string }>;
}) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();
  await requireGroupAdminPage(groupId);
  const { for: target, player } = await searchParams;
  const group = await orNotFound(api.group(groupId));

  if (target === "members") {
    const state = await api.layoutBuilderState("member_default", groupId);
    const sample =
      Number(player) ||
      group.top_player?.id ||
      group.top_players?.[0]?.id ||
      group.recent_submissions.find((sub) => sub.player_id)?.player_id ||
      null;
    if (!sample) {
      return (
        <EmptyState
          title="No member to preview with yet"
          hint="Once a member has a profile, the member layout previews on it."
        />
      );
    }
    const ctx = await loadPlayerPageContext(sample);
    return (
      <>
        <PreviewBridge />
        <PlayerPageView layout={state.draft ?? defaultPlayerLayout()} ctx={ctx} preview />
      </>
    );
  }

  const [state, ctx] = await Promise.all([
    api.layoutBuilderState("group", groupId),
    loadGroupPageContext(group),
  ]);
  return (
    <>
      <PreviewBridge />
      <GroupPageView layout={state.draft ?? defaultGroupLayout()} ctx={ctx} preview />
    </>
  );
}
