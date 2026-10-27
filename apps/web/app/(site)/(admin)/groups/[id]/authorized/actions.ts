"use server";

import { revalidatePath } from "next/cache";
import { RankRoleConfigSchema, type RankRoleConfig } from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { getUser, canAdminGroup, isGroupOwner } from "@/lib/auth";

/**
 * Roster mutations are OWNER-only (web86a). Before the split every authorized
 * user could appoint and evict every other one, including the group's creator.
 * The backend enforces this independently (`deps.assert_group_owner`); mirroring
 * it here turns the failure into a readable message instead of a raw 403.
 */
async function assertOwner(groupId: number) {
  const user = await getUser();
  if (!user || !isGroupOwner(user, groupId)) {
    throw new Error("Only this group's owner can change who administers it.");
  }
}

/** Claiming an ownerless group is open to any admin — that is the whole point. */
async function assertAdmin(groupId: number) {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
}

function revalidate(groupId: number) {
  revalidatePath(`/groups/${groupId}/authorized`);
}

/** Add an admin by Discord ID or DropTracker username. */
export async function addAuthorizedUser(groupId: number, identifier: string) {
  await assertOwner(groupId);
  const result = await api.addGroupAuthorizedUser(groupId, identifier);
  revalidate(groupId);
  return result;
}

export async function removeAuthorizedUser(
  groupId: number,
  target: { user_id?: number | null; discord_id?: string | null },
) {
  await assertOwner(groupId);
  const result = await api.removeGroupAuthorizedUser(groupId, target);
  revalidate(groupId);
  return result;
}

/** Hand the group to one of its existing admins. The old owner stays an admin. */
export async function transferOwnership(groupId: number, userId: number) {
  await assertOwner(groupId);
  const result = await api.transferGroupOwnership(groupId, userId);
  revalidate(groupId);
  return result;
}

/** Take the owner seat of a group that has none. */
export async function claimOwnership(groupId: number) {
  await assertAdmin(groupId);
  const result = await api.claimGroupOwnership(groupId);
  revalidate(groupId);
  return result;
}

/** Toggle whether Discord "Manage Server" still confers admin on this group. */
export async function setAdminPolicy(groupId: number, discordPermsGrantAdmin: boolean) {
  await assertOwner(groupId);
  const result = await api.setGroupAdminPolicy(groupId, discordPermsGrantAdmin);
  revalidate(groupId);
  return result;
}

/**
 * web141a: create the plugin verification code and return it, once. The
 * backend allows only the group's actual owner (no staff bypass); this check
 * just turns the common refusal into a readable message.
 */
export async function revealVerificationCode(groupId: number) {
  await assertOwner(groupId);
  const result = await api.revealGroupVerificationCode(groupId);
  revalidate(groupId);
  return result;
}

/** web141a: replace the active code with a new one, returned once. */
export async function resetVerificationCode(groupId: number) {
  await assertOwner(groupId);
  const result = await api.resetGroupVerificationCode(groupId);
  revalidate(groupId);
  return result;
}

/** Server Action: save the clan rank roles map, or preview it (`dryRun`). */
export async function saveRankRoles(groupId: number, config: RankRoleConfig, dryRun = false) {
  await assertAdmin(groupId);
  const parsed = RankRoleConfigSchema.parse(config);
  try {
    return await api.saveGroupRankRoles(groupId, parsed, dryRun);
  } catch (err) {
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
}

/** Server Action: re-read the rank roles panel (role list, last sync). */
export async function loadRankRoles(groupId: number) {
  await assertAdmin(groupId);
  try {
    return await api.groupRankRoles(groupId);
  } catch (err) {
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
}

/** Server Action: "Sync now", which also applies removals the bot held back. */
export async function syncRankRoles(groupId: number) {
  await assertAdmin(groupId);
  try {
    return await api.syncGroupRankRoles(groupId);
  } catch (err) {
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
}
