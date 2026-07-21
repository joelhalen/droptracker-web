"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";

/** Only FULL group admins may grant/revoke the event-manager role — an event
 * manager can never appoint another (web64a). */
async function assertAdmin(groupId: number) {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
}

/** Grant the event-manager role by Discord ID or DropTracker username. */
export async function addEventManager(groupId: number, identifier: string) {
  await assertAdmin(groupId);
  const result = await api.addGroupEventManager(groupId, identifier);
  revalidatePath(`/groups/${groupId}/event-managers`);
  return result;
}

export async function removeEventManager(groupId: number, userId: number) {
  await assertAdmin(groupId);
  const result = await api.removeGroupEventManager(groupId, userId);
  revalidatePath(`/groups/${groupId}/event-managers`);
  return result;
}
