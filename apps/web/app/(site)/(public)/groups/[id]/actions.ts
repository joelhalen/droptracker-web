"use server";

import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

/** Member contribution toward a group tier (pool model). Any signed-in group
 * member may contribute; the Web API enforces membership and computes the
 * difference price. Returns a provider-hosted checkout URL. */
export async function contributeToGroup(groupId: number, tierKey: string) {
  const user = await getUser();
  if (!user) {
    throw new Error("Sign in to support this clan.");
  }
  return api.subscriptionCheckout(groupId, tierKey);
}
