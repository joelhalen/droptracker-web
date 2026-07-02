"use server";

import { revalidatePath } from "next/cache";
import type { GroupSubscription } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

/** Server Action: grant a free, time-boxed (comped) subscription to a group. */
export async function grantComp(
  groupId: number,
  tierKey: string,
  days: number,
): Promise<GroupSubscription> {
  await requireSuperadmin("/admin/groups");
  const sub = await api.adminGrantSubscription(groupId, tierKey, days);
  revalidatePath("/admin/groups");
  return sub;
}

/** Server Action: revoke a group's comped subscription. */
export async function revokeComp(groupId: number): Promise<GroupSubscription> {
  await requireSuperadmin("/admin/groups");
  const sub = await api.adminRevokeSubscription(groupId);
  revalidatePath("/admin/groups");
  return sub;
}

/** Server Action: search groups by name for the picker. */
export async function searchGroups(
  q: string,
): Promise<{ id: number; name: string; member_count?: number }[]> {
  await requireSuperadmin("/admin/groups");
  if (!q.trim()) return [];
  const results = await api.search(q);
  return results.groups;
}
