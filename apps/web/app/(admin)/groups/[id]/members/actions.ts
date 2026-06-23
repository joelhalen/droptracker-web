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

/** Server Action: trigger an on-demand WOM membership sync. */
export async function syncWom(groupId: number) {
  await assertAdmin(groupId);
  const result = await api.womSync(groupId);
  revalidatePath(`/groups/${groupId}/members`);
  return result;
}

/** Server Action: hide/unhide a player from the group's leaderboards. */
export async function setHidden(groupId: number, playerId: number, hidden: boolean) {
  await assertAdmin(groupId);
  await api.setHiddenPlayer(groupId, playerId, hidden);
  revalidatePath(`/groups/${groupId}/members`);
  return { ok: true as const };
}
