"use server";

import { api } from "@/lib/api";

/** Generate the legacy lootboard image (share affordance, FRONTEND_PLAN.md §12). */
export async function generateLootboardImage(groupId: number, period: string) {
  return api.generateLootboardImage(groupId, period);
}
