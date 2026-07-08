"use server";

import { revalidatePath } from "next/cache";
import { AnnouncementInputSchema, type Announcement, type AnnouncementInput } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";

async function assertGroupAdmin(groupId: number) {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
}

/** Server Action: roles of the group's linked guild for the ping picker. */
export async function fetchDiscordRoles(groupId: number) {
  await assertGroupAdmin(groupId);
  return api.groupDiscordRoles(groupId);
}

/** Server Action: publish a group announcement (FRONTEND_PLAN.md §10). */
export async function publishAnnouncement(groupId: number, input: AnnouncementInput) {
  await assertGroupAdmin(groupId);
  const parsed = AnnouncementInputSchema.parse({
    ...input,
    scope_type: "group",
    group_id: groupId,
  });
  const result = await api.createAnnouncement(parsed);
  revalidatePath(`/groups/${groupId}/announcements`);
  return { ok: true as const, id: result.id };
}

/** Server Action: edit a group announcement. Group admin only. */
export async function editAnnouncement(
  groupId: number,
  id: number,
  patch: Partial<Pick<Announcement, "title" | "body_md" | "pinned">>,
): Promise<Announcement> {
  await assertGroupAdmin(groupId);
  const result = await api.updateAnnouncement(id, patch);
  revalidatePath(`/groups/${groupId}/announcements`);
  return result;
}

/** Server Action: archive (soft-delete) a group announcement. Group admin only. */
export async function archiveGroupAnnouncement(groupId: number, id: number): Promise<{ ok: true }> {
  await assertGroupAdmin(groupId);
  const result = await api.archiveAnnouncement(id);
  revalidatePath(`/groups/${groupId}/announcements`);
  return result;
}
