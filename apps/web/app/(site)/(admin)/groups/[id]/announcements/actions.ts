"use server";

import { revalidatePath } from "next/cache";
import { AnnouncementInputSchema, type Announcement, type AnnouncementInput } from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
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

/**
 * Server Action: publish a group announcement (FRONTEND_PLAN.md §10).
 *
 * Returns `{ ok: false, message }` instead of throwing on a backend refusal:
 * Next redacts thrown Server Action messages in production, and the composer
 * needs the real text (the in-game daily limit, a bad link).
 */
export async function publishAnnouncement(
  groupId: number,
  input: AnnouncementInput,
): Promise<
  | { ok: true; id: number; in_game_recipients?: number }
  | { ok: false; message: string }
> {
  await assertGroupAdmin(groupId);
  const parsed = AnnouncementInputSchema.safeParse({
    ...input,
    scope_type: "group",
    group_id: groupId,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: `${issue?.path.join(".") || "Input"}: ${issue?.message ?? "invalid"}` };
  }
  try {
    const result = await api.createAnnouncement(parsed.data);
    revalidatePath(`/groups/${groupId}/announcements`);
    return { ok: true, id: result.id, in_game_recipients: result.in_game_recipients };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, message: err.message };
    throw err;
  }
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
