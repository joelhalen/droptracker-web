"use server";

import { revalidatePath } from "next/cache";
import type { AdminEventType } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

type Result = { ok: true; row: AdminEventType } | { ok: false; error: string };

/** Toggle a kind's enabled / admin_only flags. Superadmin only. */
export async function patchEventType(
  key: string,
  patch: { enabled?: boolean; admin_only?: boolean },
): Promise<Result> {
  await requireSuperadmin("/admin/event-types");
  try {
    const row = await api.adminPatchEventType(key, patch);
    revalidatePath("/admin/event-types");
    return { ok: true as const, row };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message || "Update failed." };
  }
}

/** Add a group to a kind's test allowlist. */
export async function addEventTypeTestGroup(key: string, groupId: number): Promise<Result> {
  await requireSuperadmin("/admin/event-types");
  try {
    const row = await api.adminAddEventTypeTestGroup(key, groupId);
    revalidatePath("/admin/event-types");
    return { ok: true as const, row };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message || "Couldn't add the group." };
  }
}

/** Remove a group from a kind's test allowlist. */
export async function removeEventTypeTestGroup(key: string, groupId: number): Promise<Result> {
  await requireSuperadmin("/admin/event-types");
  try {
    const row = await api.adminRemoveEventTypeTestGroup(key, groupId);
    revalidatePath("/admin/event-types");
    return { ok: true as const, row };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message || "Couldn't remove the group." };
  }
}

/** Group search for the allowlist picker (id + name). */
export async function searchTestGroups(
  q: string,
): Promise<{ id: number; name: string }[]> {
  await requireSuperadmin("/admin/event-types");
  if (!q.trim()) return [];
  const results = await api.search(q);
  return results.groups.map((g) => ({ id: g.id, name: g.name }));
}
