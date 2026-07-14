"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";

async function assertAdmin(groupId: number) {
  const user = await getUser();
  if (!user) throw new Error("Forbidden: sign in required.");
  if (!canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
}

export async function listManualSubmissions(groupId: number) {
  await assertAdmin(groupId);
  return api.manualSubmissions(groupId);
}

export async function approveManualSubmission(groupId: number, dropId: number) {
  await assertAdmin(groupId);
  const res = await api.approveManualSubmission(groupId, dropId);
  revalidatePath(`/groups/${groupId}/submissions`);
  return res;
}

export async function rejectManualSubmission(groupId: number, dropId: number) {
  await assertAdmin(groupId);
  const res = await api.rejectManualSubmission(groupId, dropId);
  revalidatePath(`/groups/${groupId}/submissions`);
  return res;
}
