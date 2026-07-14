"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";

async function assertAdmin(groupId: number) {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
}

/** Add an authorized user by Discord ID or DropTracker username. */
export async function addAuthorizedUser(groupId: number, identifier: string) {
  await assertAdmin(groupId);
  const result = await api.addGroupAuthorizedUser(groupId, identifier);
  revalidatePath(`/groups/${groupId}/authorized`);
  return result;
}

export async function removeAuthorizedUser(
  groupId: number,
  target: { user_id?: number | null; discord_id?: string | null },
) {
  await assertAdmin(groupId);
  const result = await api.removeGroupAuthorizedUser(groupId, target);
  revalidatePath(`/groups/${groupId}/authorized`);
  return result;
}
