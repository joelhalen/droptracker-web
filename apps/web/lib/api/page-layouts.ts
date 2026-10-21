import { z } from "zod";
import { apiGet, apiSend } from "./_client";
import {
  SubmissionSchema,
  type Submission,
  LayoutBuilderStateSchema,
  PublicGroupLayoutSchema,
  PublicPlayerLayoutSchema,
  type LayoutBuilderState,
  type LayoutScope,
  type PageLayout,
  type PublicPlayerLayout,
} from "@droptracker/api-types";

/** Cache tag for a public layout read; publish actions revalidate it. */
export const layoutTag = (scope: "group" | "player", id: number) => `layout:${scope}:${id}`;

function builderBase(scope: LayoutScope, id: number): string {
  if (scope === "player") return `/players/${id}/page-layout`;
  if (scope === "member_default") return `/groups/${id}/member-layout`;
  return `/groups/${id}/page-layout`;
}

export const pageLayoutsApi = {
  // --- public reads (page render) ------------------------------------------

  /** The group's published layout, or null for the standard page. */
  async groupPageLayout(groupId: number): Promise<PageLayout | null> {
    const raw = await apiGet(`/groups/${groupId}/page-layout`, {
      revalidate: 30,
      tags: [layoutTag("group", groupId)],
    });
    return PublicGroupLayoutSchema.parse(raw).layout;
  },

  /** The layout in force on a profile: the player's own, their clan's
   * member layout, or null for the standard profile. */
  async playerPageLayout(playerId: number): Promise<PublicPlayerLayout> {
    const raw = await apiGet(`/players/${playerId}/page-layout`, {
      revalidate: 30,
      tags: [layoutTag("player", playerId)],
    });
    return PublicPlayerLayoutSchema.parse(raw);
  },

  /** Typed recent activity for the Highlights blocks: drops, collection log
   * slots, PBs and pets, newest first, hidden players left out. */
  async highlights(
    scope: "group" | "player",
    id: number,
    types: readonly string[],
    limit: number,
  ): Promise<Submission[]> {
    const q = new URLSearchParams({ types: types.join(","), limit: String(limit) });
    const raw = await apiGet(`/${scope === "group" ? "groups" : "players"}/${id}/highlights?${q}`, {
      revalidate: 30,
    });
    return z.object({ items: z.array(SubmissionSchema) }).parse(raw).items;
  },

  // --- builder (session-authed) --------------------------------------------

  async layoutBuilderState(scope: LayoutScope, id: number): Promise<LayoutBuilderState> {
    return LayoutBuilderStateSchema.parse(
      await apiGet(`${builderBase(scope, id)}/draft`, { authed: true }),
    );
  },

  async saveLayoutDraft(scope: LayoutScope, id: number, layout: PageLayout): Promise<LayoutBuilderState> {
    return LayoutBuilderStateSchema.parse(
      await apiSend("PUT", `${builderBase(scope, id)}/draft`, { layout }),
    );
  },

  async publishLayout(scope: LayoutScope, id: number): Promise<LayoutBuilderState> {
    return LayoutBuilderStateSchema.parse(await apiSend("POST", `${builderBase(scope, id)}/publish`, {}));
  },

  async unpublishLayout(scope: LayoutScope, id: number): Promise<LayoutBuilderState> {
    return LayoutBuilderStateSchema.parse(await apiSend("POST", `${builderBase(scope, id)}/unpublish`, {}));
  },

  async discardLayoutDraft(scope: LayoutScope, id: number): Promise<LayoutBuilderState> {
    return LayoutBuilderStateSchema.parse(await apiSend("DELETE", `${builderBase(scope, id)}/draft`, {}));
  },
};
