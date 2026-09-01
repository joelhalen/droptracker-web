"use server";

import { revalidatePath } from "next/cache";
import {
  GroupConfigPatchSchema,
  HALL_OF_FAME_CONFIG_KEYS,
  type AlwaysListEntryType,
  type BlacklistEntryType,
  type EventMetaEntry,
  type GroupConfigPatch,
  type NotificationBlacklist,
} from "@droptracker/api-types";
import { api, ApiError, type DiscordChannelList, type LootboardStyleList, type PbBossList } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";
import { hasEntitlement } from "@/lib/entitlements";

/** Server Action: persist a group-config patch after an authorization check. */
export async function saveGroupConfig(groupId: number, patch: GroupConfigPatch) {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  const parsed = GroupConfigPatchSchema.parse(patch);

  const hofKeys = Object.keys(parsed).filter((k) =>
    HALL_OF_FAME_CONFIG_KEYS.includes(k as (typeof HALL_OF_FAME_CONFIG_KEYS)[number]),
  );
  if (hofKeys.length > 0 && !user.is_superadmin) {
    const sub = await api.groupSubscription(groupId);
    if (!hasEntitlement(sub, "hall_of_fame")) {
      throw new Error("Hall of Fame requires a higher subscription tier.");
    }
  }

  try {
    await api.updateGroupConfig(groupId, parsed as GroupConfigPatch);
  } catch (err) {
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
  revalidatePath(`/groups/${groupId}/settings`);
  // `group_name` renames the group rather than saving a setting: the name is
  // rendered by the admin shell header and every public group page, so drop the
  // whole subtree's cache instead of just this page.
  if ("group_name" in parsed) revalidatePath(`/groups/${groupId}`, "layout");
  return { ok: true as const };
}

/** Server Action: upload a new group icon (multipart 'file' entry). */
export async function uploadGroupIcon(groupId: number, form: FormData) {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  try {
    const { icon_url } = await api.uploadGroupIcon(groupId, form);
    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/settings`);
    return { ok: true as const, icon_url };
  } catch (err) {
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
}

/** Server Action: remove the group's icon. */
export async function removeGroupIcon(groupId: number) {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  try {
    await api.deleteGroupIcon(groupId);
  } catch (err) {
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/settings`);
  return { ok: true as const };
}

/** Server Action: generate a custom-timeframe lootboard PNG (leaders only).
 * Backend errors (invalid range, month still backfilling, per-group cooldown)
 * carry user-presentable messages — surface them verbatim. */
export async function generateTimeframeBoard(
  groupId: number,
  startDate: string,
  endDate: string,
): Promise<{ url: string; start_date: string; end_date: string }> {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  try {
    const { url, start_date, end_date } = await api.generateTimeframeBoard(
      groupId,
      startDate,
      endDate,
    );
    return { url, start_date, end_date };
  } catch (err) {
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
}

/** Server Action: list the group's Discord text channels for the channel picker. */
export async function fetchGroupDiscordChannels(groupId: number): Promise<DiscordChannelList> {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  return api.groupDiscordChannels(groupId);
}

/** Server Action: boss names with stored PBs, for the Hall of Fame boss picker. */
export async function fetchGroupPbBosses(groupId: number): Promise<PbBossList> {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  return api.groupPbBosses(groupId);
}

/** Server Action: the lootboard style catalog for the board-style picker. */
export async function fetchLootboardStyles(groupId: number): Promise<LootboardStyleList> {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  return api.lootboardStyles();
}


/** Server Action: item/NPC autocomplete for the notification-blacklist picker.
 *
 * Reuses the event task builder's `/events/meta/*` search rather than the
 * public one: it is restricted to names that have actually been seen in the
 * drop history, which is exactly the set a blacklist entry could ever match.
 */
export async function searchBlacklistCandidates(
  groupId: number,
  kind: BlacklistEntryType,
  query: string,
): Promise<EventMetaEntry[]> {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  if (query.trim().length < 2) return [];
  if (kind === "region") {
    // Areas are static reference data, not a drop-history catalog, so this is a
    // filter rather than a search. `id` carries the area's first region id: the
    // backend ignores it for a name entry (an area spans several regions, so no
    // single id names it) and it gives the row something stable to key on.
    const { regions } = await api.groupBlacklistRegions(groupId, query);
    return regions.slice(0, 25).map((area) => ({
      id: area.regions[0] ?? 0,
      name: area.name,
    }));
  }
  return kind === "npc" ? api.searchEventNpcs(query) : api.searchEventItems(query);
}

/** Server Action: mute an item or NPC in this group's Discord notifications.
 * Returns the whole list so the client never has to guess the server's
 * normalization (`match_key`) or ordering. */
export async function addBlacklistEntry(
  groupId: number,
  kind: BlacklistEntryType,
  name: string,
  gameId: number | null,
): Promise<NotificationBlacklist> {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  try {
    const result = await api.addGroupNotificationBlacklistEntry(groupId, kind, name, gameId);
    revalidatePath(`/groups/${groupId}/settings`);
    return result;
  } catch (err) {
    // The backend refuses names it could never match ("Unknown", punctuation
    // only) with a message worth showing verbatim.
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
}

/** Server Action: un-mute one blacklist entry. */
export async function removeBlacklistEntry(
  groupId: number,
  entryId: number,
): Promise<NotificationBlacklist> {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  try {
    const result = await api.removeGroupNotificationBlacklistEntry(groupId, entryId);
    revalidatePath(`/groups/${groupId}/settings`);
    return result;
  } catch (err) {
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
}

/** Server Action: always-announce an item or NPC in this group's Discord —
 * drops of it post even below the minimum notification value. Returns the
 * whole list, same contract as the blacklist actions. */
export async function addAlwaysListEntry(
  groupId: number,
  kind: AlwaysListEntryType,
  name: string,
  gameId: number | null,
): Promise<NotificationBlacklist> {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  try {
    const result = await api.addGroupNotificationAlwaysListEntry(groupId, kind, name, gameId);
    revalidatePath(`/groups/${groupId}/settings`);
    return result;
  } catch (err) {
    // The backend refuses names it could never match ("Unknown", punctuation
    // only) with a message worth showing verbatim.
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
}

/** Server Action: remove one always-announce entry. */
export async function removeAlwaysListEntry(
  groupId: number,
  entryId: number,
): Promise<NotificationBlacklist> {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  try {
    const result = await api.removeGroupNotificationAlwaysListEntry(groupId, entryId);
    revalidatePath(`/groups/${groupId}/settings`);
    return result;
  } catch (err) {
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
}
