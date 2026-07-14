"use server";

import { revalidatePath } from "next/cache";
import { SubscriptionTierInputSchema, type SubscriptionTierInput } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

/** Server Action: create or update a subscription tier. Superadmin only. */
export async function saveTier(tier: SubscriptionTierInput, isNew: boolean) {
  await requireSuperadmin("/admin/tiers");
  const parsed = SubscriptionTierInputSchema.parse(tier);
  await api.adminSaveTier(parsed, isNew);
  revalidatePath("/admin/tiers");
  revalidatePath("/premium");
  return { ok: true as const };
}

export async function deleteTier(key: string) {
  await requireSuperadmin("/admin/tiers");
  await api.adminDeleteTier(key);
  revalidatePath("/admin/tiers");
  revalidatePath("/premium");
  return { ok: true as const };
}
