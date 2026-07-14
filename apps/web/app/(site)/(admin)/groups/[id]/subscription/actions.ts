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

/** Start a contribution leg toward a tier (pool model: pays the difference
 * between the tier price and the group's current pool). Backend enforces
 * group membership; this admin-page action additionally requires admin. */
export async function startCheckout(groupId: number, tierKey: string) {
  await assertAdmin(groupId);
  return api.subscriptionCheckout(groupId, tierKey);
}

/** Wind down one contribution leg (backend allows payer-or-admin; this page
 * is admin-gated). Returns the refreshed pool view. */
export async function cancelLeg(groupId: number, legId: number) {
  await assertAdmin(groupId);
  const sub = await api.cancelSubscriptionLeg(groupId, legId);
  revalidatePath(`/groups/${groupId}/subscription`);
  return sub;
}

export async function resumeLeg(groupId: number, legId: number) {
  await assertAdmin(groupId);
  const sub = await api.resumeSubscriptionLeg(groupId, legId);
  revalidatePath(`/groups/${groupId}/subscription`);
  return sub;
}

export async function openBillingPortal(groupId: number) {
  await assertAdmin(groupId);
  return api.billingPortal(groupId);
}
