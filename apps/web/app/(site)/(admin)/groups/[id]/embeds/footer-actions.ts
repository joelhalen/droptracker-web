"use server";

import { revalidatePath } from "next/cache";
import {
  NotificationFootersInputSchema,
  type NotificationFooters,
  type NotificationFootersInput,
} from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";
import { hasEntitlement } from "@/lib/entitlements";

/** Returned rather than thrown: production redacts Server Action errors. */
export type FooterActionResult =
  | { ok: true; data: NotificationFooters }
  | { ok: false; error: string };

function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

/** Server Action: replace the group's footer choices (custom_footer entitlement). */
export async function saveNotificationFootersAction(
  groupId: number,
  input: NotificationFootersInput,
): Promise<FooterActionResult> {
  try {
    const user = await getUser();
    if (!user || !canAdminGroup(user, groupId)) {
      return { ok: false, error: "Forbidden: you do not administer this group." };
    }
    if (!user.is_superadmin) {
      const sub = await api.groupSubscription(groupId);
      if (!hasEntitlement(sub, "custom_footer")) {
        return { ok: false, error: "Custom footers need a paid plan." };
      }
    }
    const parsed = NotificationFootersInputSchema.parse(input);
    const saved = await api.saveNotificationFooters(groupId, parsed);
    revalidatePath(`/groups/${groupId}/embeds`);
    return { ok: true, data: saved };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

/** Server Action: back to the DropTracker footer everywhere. Needs no plan. */
export async function resetNotificationFootersAction(groupId: number): Promise<FooterActionResult> {
  try {
    const user = await getUser();
    if (!user || !canAdminGroup(user, groupId)) {
      return { ok: false, error: "Forbidden: you do not administer this group." };
    }
    const saved = await api.resetNotificationFooters(groupId);
    revalidatePath(`/groups/${groupId}/embeds`);
    return { ok: true, data: saved };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}
