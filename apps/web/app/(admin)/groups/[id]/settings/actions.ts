"use server";

import { revalidatePath } from "next/cache";
import { GroupConfigPatchSchema, type GroupConfigPatch } from "@droptracker/api-types";
import { api, type DiscordChannelList } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";

/** Server Action: persist a group-config patch after an authorization check. */
export async function saveGroupConfig(groupId: number, patch: GroupConfigPatch) {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  // Validate against the typed registry before writing (API re-validates too).
  const parsed = GroupConfigPatchSchema.parse(patch);
  await api.updateGroupConfig(groupId, parsed as GroupConfigPatch);
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
