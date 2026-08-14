import { apiGet, withFallback } from "./_client";
import {
  ResolveResultSchema,
  type ResolveResult,
  PbBossBoardSchema,
  type PbBossBoard,
  PbBossIndexSchema,
  type PbBossIndex,
  ItemDetailSchema,
  type ItemDetail,
  NpcDetailSchema,
  type NpcDetail,
  NpcDropTableSchema,
  type NpcDropTable,
  type Recap,
  RecapSchema,
  type RecapIndex,
  RecapIndexSchema,
  type ClanLog,
  ClanLogSchema,
  ClanLogPeriodsSchema,
} from "@droptracker/api-types";
import {
  mockResolve,
  mockPbBoard,
  mockPbBosses,
  mockItemDetail,
  mockNpcDetail,
  mockNpcDropTable,
} from "../mock-data";

export const npcsApi = {

  // --- Personal-best leaderboards -----------------------------------------
  /** Boss index for the PB leaderboards (optionally scoped to one group). */
  async pbBosses(groupId?: number): Promise<PbBossIndex> {
    const q = groupId != null ? `?group_id=${groupId}` : "";
    return withFallback(
      async () =>
        PbBossIndexSchema.parse(await apiGet(`/personal-bests/bosses${q}`, { revalidate: 120 })),
      () => mockPbBosses(groupId),
    );
  },


  /** Every team-size board for one boss (optionally scoped to one group). */
  async pbBoard(npcId: number, groupId?: number): Promise<PbBossBoard | null> {
    const q = groupId != null ? `&group_id=${groupId}` : "";
    return withFallback(
      async () =>
        PbBossBoardSchema.parse(
          await apiGet(`/personal-bests/board?npc_id=${npcId}${q}`, { revalidate: 120 }),
        ),
      () => mockPbBoard(npcId, groupId),
    ).catch(() => null); // 404 = no ranked times for this boss
  },


  // --- NPC / item pages -----------------------------------------------------
  /** NPC overview: lifetime + month totals, top players, recent drops. */
  /**
   * One recap card. A settled period's card never changes, so it caches hard.
   * 404 (→ null) is the normal answer for a subject below the activity floor,
   * not an error worth surfacing.
   */
  async recap(
    scope: "group" | "player",
    subjectId: number,
    period: string,
    /**
     * Bypass the cache. For the screenshot route: its PNG gets archived and
     * posted, so rendering an hour-stale payload bakes yesterday's numbers into
     * a permanent artifact — and after regenerating a snapshot (a backfill, a
     * bug fix) the re-render would silently reproduce the old card.
     */
    fresh = false,
  ): Promise<Recap | null> {
    return withFallback(
      async () =>
        RecapSchema.parse(
          await apiGet(
            `/recaps/${scope}/${subjectId}/${period}`,
            fresh ? { revalidate: 0 } : { revalidate: 3600 },
          ),
        ),
      () => null,
    ).catch(() => null);
  },


  /** Every period a subject has a card for, newest first (the archive list). */
  async recapIndex(
    scope: "group" | "player",
    subjectId: number,
  ): Promise<RecapIndex | null> {
    return withFallback(
      async () =>
        RecapIndexSchema.parse(
          await apiGet(`/recaps/${scope}/${subjectId}`, { revalidate: 3600 }),
        ),
      () => null,
    ).catch(() => null);
  },


  /**
   * A clan's unique-completion board for one period ("all", "YYYY", "YYYY-MM").
   *
   * 404 (→ null) is the normal answer for a group whose board has never been
   * built, not an error worth surfacing. Short revalidate rather than the
   * recap's hour: unlike a settled recap, this board moves whenever a member
   * pulls something.
   */
  async clanLog(groupId: number, period = "all", fresh = false): Promise<ClanLog | null> {
    return withFallback(
      async () =>
        ClanLogSchema.parse(
          await apiGet(`/groups/${groupId}/clan-log?period=${encodeURIComponent(period)}`, {
            revalidate: fresh ? 0 : 300,
          }),
        ),
      () => null,
    ).catch(() => null);
  },


  /** Every period this group's board can be shown for (all-time first). */
  async clanLogPeriods(groupId: number): Promise<string[]> {
    return withFallback(
      async () =>
        ClanLogPeriodsSchema.parse(
          await apiGet(`/groups/${groupId}/clan-log/periods`, { revalidate: 300 }),
        ).periods,
      () => [] as string[],
    ).catch(() => [] as string[]);
  },


  async npcDetail(npcId: number): Promise<NpcDetail | null> {
    return withFallback(
      async () => NpcDetailSchema.parse(await apiGet(`/npcs/${npcId}`, { revalidate: 60 })),
      () => mockNpcDetail(npcId),
    ).catch(() => null); // 404 = unknown NPC
  },


  /** Wiki drop table for one NPC, with most-recent receiver per item. */
  async npcDropTable(npcId: number): Promise<NpcDropTable | null> {
    return withFallback(
      async () =>
        // Short revalidate so "building" registries surface quickly once warm.
        NpcDropTableSchema.parse(await apiGet(`/npcs/${npcId}/drop-table`, { revalidate: 30 })),
      () => mockNpcDropTable(npcId),
    ).catch(() => null); // 404 = unknown NPC (a known NPC with no table returns items: [])
  },


  /** Item overview: totals, GE value, recent/top receivers, drop sources. */
  async itemDetail(itemId: number): Promise<ItemDetail | null> {
    return withFallback(
      async () => ItemDetailSchema.parse(await apiGet(`/items/${itemId}`, { revalidate: 60 })),
      () => mockItemDetail(itemId),
    ).catch(() => null); // 404 = unknown item
  },


  /**
   * Resolve a nice-URL slug (`/groups/awesome-clan`) to its entity, or — when a
   * group/player name is shared — to a candidate list for a disambiguation page.
   * NPC/item duplicate names collapse to the primary id. See `lib/entity-ref.ts`.
   */
  async resolve(kind: "group" | "player" | "npc" | "item", slug: string): Promise<ResolveResult> {
    return withFallback(
      async () =>
        ResolveResultSchema.parse(
          await apiGet(`/resolve/${kind}?slug=${encodeURIComponent(slug)}`, { revalidate: 300 }),
        ),
      () => mockResolve(kind, slug),
    );
  },
};
