/**
 * Data loaders shared by the public pages and the builder preview (web137a),
 * so the preview shows exactly what a visitor will see.
 */
import type { GroupProfile } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { getUser, groupManageLink } from "@/lib/auth";
import { publicGroupEvents } from "@/lib/group-events";
import type { GroupPageContext } from "@/components/page-layout/group-page-view";
import type { PlayerPageContext } from "@/components/page-layout/player-page-view";

export async function loadGroupPageContext(group: GroupProfile): Promise<GroupPageContext> {
  const groupId = group.id;
  // Every extra is best-effort: the page renders without any of them.
  const [subSummary, viewer, recaps, bank, activeEvents, pastEvents] = await Promise.all([
    api.groupSubscriptionSummary(groupId).catch(() => null),
    getUser().catch(() => null),
    // The recap archive had no way in from the clan's own page (t272).
    api.recapIndex("group", groupId).catch(() => null),
    // Clan bank (web131a): shown once something has been recorded, unless the
    // group keeps it private.
    api.groupBank(groupId).catch(() => null),
    // The group's public events (suggestion #210): the Events block and the
    // Events link both read this, so they agree on whether there are any.
    api.events({ groupId, status: "active" }).catch(() => []),
    api.events({ groupId, status: "past" }).catch(() => []),
  ]);
  return {
    group,
    // Pretty base for the group's own sub-nav (slug when the name is unique,
    // else id). Sub-routes resolve either form.
    base: group.canonical_slug ? `/groups/${group.canonical_slug}` : `/groups/${groupId}`,
    subSummary,
    bank,
    latestRecap: recaps?.periods[0]?.period ?? null,
    events: publicGroupEvents(activeEvents, pastEvents),
    signedIn: viewer != null,
    // Admins (and event managers) get a shortcut into the admin shell.
    manage: groupManageLink(viewer, groupId),
  };
}

export async function loadPlayerPageContext(playerId: number): Promise<PlayerPageContext> {
  const player = await api.player(playerId);
  // Non-critical: a profile must still render for the majority who have
  // never synced.
  const [loot, collectionLog, achievements, pvp] = await Promise.all([
    api.playerLoot(playerId).catch(() => null),
    api.playerCollectionLog(playerId).catch(() => null),
    api.playerAchievements(playerId).catch(() => null),
    // PvP record (web136a): only shown once the player has a kill or a death.
    api.playerPvp(playerId).catch(() => null),
  ]);
  return { player, loot, collectionLog, achievements, pvp };
}
