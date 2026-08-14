"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  NotificationLayoutInputSchema,
  type NotificationLayoutInput,
  type SavedNotificationLayout,
} from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";

/**
 * Server Actions for the notification components builder.
 *
 * Same discriminated-result pattern as the embed and event-layout actions:
 * Next redacts thrown Server Action errors in production, and the editor needs
 * the backend's real validation detail — "Block 3 needs some text" is the whole
 * point of validating there.
 *
 * The pilot allowlist is not re-checked here, deliberately: it lives in
 * services/component_layout.py next to the send path that honours it, and the
 * Web API refuses writes for a group outside it. Duplicating the group ids in
 * the frontend would create a second list to forget to update.
 */
export type NotificationLayoutActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

/** Save (and optionally activate) the group's layout for one notification type. */
export async function saveGroupNotificationLayoutAction(
  groupId: number,
  notificationType: string,
  input: NotificationLayoutInput,
): Promise<NotificationLayoutActionResult<SavedNotificationLayout>> {
  try {
    const user = await getUser();
    if (!user || !canAdminGroup(user, groupId)) {
      return { ok: false, error: "Forbidden: you do not administer this group." };
    }
    const parsed = NotificationLayoutInputSchema.parse(input);
    const saved = await api.saveGroupNotificationLayout(groupId, notificationType, parsed);
    revalidatePath(`/groups/${groupId}/embeds`);
    return { ok: true, data: saved };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

/** Delete the group's layout for one type — it goes back to its embed. */
export async function resetGroupNotificationLayoutAction(
  groupId: number,
  notificationType: string,
): Promise<NotificationLayoutActionResult<null>> {
  try {
    const user = await getUser();
    if (!user || !canAdminGroup(user, groupId)) {
      return { ok: false, error: "Forbidden: you do not administer this group." };
    }
    await api.deleteGroupNotificationLayout(groupId, notificationType);
    revalidatePath(`/groups/${groupId}/embeds`);
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}
