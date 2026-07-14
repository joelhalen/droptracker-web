"use server";

import { revalidatePath } from "next/cache";
import { api, type AdminDataRow } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

/** Server Action: search users by username/Discord ID for the picker. */
export async function searchUsers(
  q: string,
): Promise<{ id: number; label: string; discord_id: string | null }[]> {
  await requireSuperadmin("/admin/users");
  if (!q.trim()) return [];
  const res = await api.adminDataList("users", { q, limit: 10 });
  return res.rows.map((row: AdminDataRow) => ({
    id: Number(row.user_id),
    label: String(row.username ?? row.discord_id ?? row.user_id),
    discord_id: row.discord_id != null ? String(row.discord_id) : null,
  }));
}

/** Server Action: grant/revoke moderator on a user (also toggles the
 * profile badge server-side). Superadmin only. */
export async function setUserModerator(
  userId: number,
  grant: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperadmin("/admin/users");
  try {
    await api.adminSetUserModerator(userId, grant);
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Failed to update moderator access." };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

/** Server Action: grant or revoke superadmin on a user. Superadmin only. */
export async function setUserSuperadmin(
  userId: number,
  grant: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperadmin("/admin/users");
  try {
    await api.adminSetUserSuperadmin(userId, grant);
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Failed to update superadmin access." };
  }
  revalidatePath("/admin/users");
  return { ok: true as const };
}
