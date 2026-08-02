"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

/**
 * Set (or clear, with null) how many boost slots a user is credited with.
 *
 * The reconciler still refuses to credit anyone who is not actually boosting
 * and still clamps the guild-wide total, so this corrects attribution — it
 * cannot mint credit out of nothing.
 */
export async function setNitroBoostSlots(userId: number, slots: number | null) {
  await requireSuperadmin("/admin/nitro-boosts");
  if (slots !== null && (!Number.isInteger(slots) || slots < 1)) {
    throw new Error("Boost count must be a whole number of at least 1 (or cleared).");
  }
  const result = await api.adminSetNitroBoosts(userId, slots);
  revalidatePath("/admin/nitro-boosts");
  return result;
}
