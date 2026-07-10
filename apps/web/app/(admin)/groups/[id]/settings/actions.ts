"use server";

import { revalidatePath } from "next/cache";
import { GroupConfigPatchSchema, HALL_OF_FAME_CONFIG_KEYS, type GroupConfigPatch } from "@droptracker/api-types";
import { api, ApiError, type DiscordChannelList, type PbBossList } from "@/lib/api";
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
