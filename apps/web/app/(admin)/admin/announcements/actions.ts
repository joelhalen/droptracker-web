"use server";

import { revalidatePath } from "next/cache";
import { AnnouncementInputSchema, type AnnouncementInput } from "@droptracker/api-types";
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
