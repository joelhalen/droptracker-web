"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
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
