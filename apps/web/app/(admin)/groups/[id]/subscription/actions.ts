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

/** Begin or switch to a paid tier; returns a provider-hosted checkout URL. */
export async function startCheckout(groupId: number, tierKey: string) {
  await assertAdmin(groupId);
  return api.subscriptionCheckout(groupId, tierKey);
}

export async function cancelSubscription(groupId: number) {
  await assertAdmin(groupId);
  const sub = await api.cancelSubscription(groupId);
  revalidatePath(`/groups/${groupId}/subscription`);
  return sub;
}

export async function resumeSubscription(groupId: number) {
  await assertAdmin(groupId);
  const sub = await api.resumeSubscription(groupId);
  revalidatePath(`/groups/${groupId}/subscription`);
  return sub;
}

export async function openBillingPortal(groupId: number) {
  await assertAdmin(groupId);
  return api.billingPortal(groupId);
}
