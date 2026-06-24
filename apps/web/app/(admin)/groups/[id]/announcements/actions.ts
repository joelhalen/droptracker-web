"use server";

import { revalidatePath } from "next/cache";
import { AnnouncementInputSchema, type AnnouncementInput } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";

/** Server Action: publish a group announcement (FRONTEND_PLAN.md §10). */
export async function publishAnnouncement(groupId: number, input: AnnouncementInput) {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  const parsed = AnnouncementInputSchema.parse({
    ...input,
    scope_type: "group",
    group_id: groupId,
  });
  const result = await api.createAnnouncement(parsed);
  revalidatePath(`/groups/${groupId}/announcements`);
  return { ok: true as const, id: result.id };
}
