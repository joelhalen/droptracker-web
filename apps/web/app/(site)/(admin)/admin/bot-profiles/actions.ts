"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

/** Server Action: put a group's bot back to its default look. Superadmin only. */
export async function adminResetBotProfile(groupId: number) {
  await requireSuperadmin("/admin/bot-profiles");
  try {
    await api.adminResetBotProfile(groupId);
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Failed to reset the bot profile" };
  }
  revalidatePath("/admin/bot-profiles");
  return { ok: true as const };
}
