"use server";

import type { UserSubscription } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

/** Current user's supporter subscription, or null when signed out. */
export async function getSupporterStatus(): Promise<UserSubscription | null> {
  const user = await getUser();
  if (!user) return null;
  return api.mySubscription();
}

/** Begin (or switch to) a supporter tier; returns a provider checkout URL. */
export async function startSupporterCheckout(tierKey: string) {
  const user = await getUser();
  if (!user) throw new Error("Sign in to become a supporter.");
  return api.mySubscriptionCheckout(tierKey);
}

export async function cancelSupporter() {
  const user = await getUser();
  if (!user) throw new Error("Not signed in.");
  return api.cancelMySubscription();
}

export async function resumeSupporter() {
  const user = await getUser();
  if (!user) throw new Error("Not signed in.");
  return api.resumeMySubscription();
}

export async function openSupporterPortal() {
  const user = await getUser();
  if (!user) throw new Error("Not signed in.");
  return api.myBillingPortal();
}
