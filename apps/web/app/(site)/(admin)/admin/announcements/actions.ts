"use server";

import { revalidatePath } from "next/cache";
import { AnnouncementInputSchema, type Announcement, type AnnouncementInput } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

/** Server Action: publish a site-wide (global) announcement. Superadmin only. */
export async function publishGlobalAnnouncement(input: AnnouncementInput) {
  await requireSuperadmin("/admin/announcements");
  const parsed = AnnouncementInputSchema.parse({
    ...input,
    scope_type: "global",
    group_id: null,
  });
  const result = await api.createAnnouncement(parsed);
  revalidatePath("/admin/announcements");
  revalidatePath("/announcements");
  return { ok: true as const, id: result.id };
}

/** Server Action: edit a global announcement. Superadmin only. */
export async function editGlobalAnnouncement(
  id: number,
  patch: Partial<Pick<Announcement, "title" | "body_md" | "pinned">>,
): Promise<Announcement> {
  await requireSuperadmin("/admin/announcements");
  const result = await api.updateAnnouncement(id, patch);
  revalidatePath("/admin/announcements");
  revalidatePath("/announcements");
  return result;
}

/** Server Action: archive (soft-delete) a global announcement. Superadmin only. */
export async function archiveGlobalAnnouncement(id: number): Promise<{ ok: true }> {
  await requireSuperadmin("/admin/announcements");
  const result = await api.archiveAnnouncement(id);
  revalidatePath("/admin/announcements");
  revalidatePath("/announcements");
  return result;
}
