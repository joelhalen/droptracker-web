"use server";

import { revalidatePath } from "next/cache";
import { AdminBadgeInputSchema, type AdminBadgeInput, type PlayerBadge } from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

/** Server Action: create or update a badge definition. Superadmin only. */
export async function saveBadge(input: AdminBadgeInput) {
  await requireSuperadmin("/admin/badges");
  const parsed = AdminBadgeInputSchema.parse(input);
  try {
    await api.adminSaveBadge(parsed);
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Failed to save badge" };
  }
  revalidatePath("/admin/badges");
  return { ok: true as const };
}

export async function deleteBadge(key: string) {
  await requireSuperadmin("/admin/badges");
  try {
    await api.adminDeleteBadge(key);
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Failed to delete badge" };
  }
  revalidatePath("/admin/badges");
  return { ok: true as const };
}

/** Look up players by name for the award panel. */
export async function lookupPlayers(q: string) {
  await requireSuperadmin("/admin/badges");
  const res = await api.adminLookup(q);
  return res.results.filter((r) => r.category === "player").slice(0, 8);
}

/** A player's badge awards (for the revoke list). */
export async function listPlayerBadges(playerId: number): Promise<PlayerBadge[]> {
  await requireSuperadmin("/admin/badges");
  return api.playerBadges(playerId);
}

export async function awardBadge(playerId: number, badgeKey: string, note?: string) {
  await requireSuperadmin("/admin/badges");
  try {
    const res = await api.adminAwardBadge(playerId, badgeKey, note);
    revalidatePath("/admin/badges");
    revalidatePath(`/players/${playerId}`);
    return { ok: true as const, awardId: res.award_id };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Failed to award badge" };
  }
}

export async function revokeBadge(playerId: number, awardId: number) {
  await requireSuperadmin("/admin/badges");
  try {
    await api.adminRevokeBadge(playerId, awardId);
    revalidatePath("/admin/badges");
    revalidatePath(`/players/${playerId}`);
    return { ok: true as const };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Failed to revoke badge" };
  }
}
