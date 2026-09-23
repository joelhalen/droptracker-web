"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  HofLayoutInputSchema,
  type HofLayoutInput,
  type HofLayoutPreview,
  type SavedHofLayout,
} from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";
import { hasEntitlement } from "@/lib/entitlements";

/**
 * Server Actions for the Hall of Fame layout editor.
 *
 * Same discriminated-result pattern as the notification layout actions: Next
 * redacts thrown Server Action errors in production, and the editor needs the
 * backend's own validation text ("Block 3: show between 1 and 10 places").
 * Saving is gated on the hall_of_fame entitlement here for a plain answer; the
 * Web API enforces it again.
 */
export type HofLayoutActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

async function assertAdmin(groupId: number) {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) return null;
  return user;
}

export async function saveHofLayoutAction(
  groupId: number,
  input: HofLayoutInput,
): Promise<HofLayoutActionResult<SavedHofLayout>> {
  try {
    const user = await assertAdmin(groupId);
    if (!user) return { ok: false, error: "Forbidden: you do not administer this group." };
    if (!user.is_superadmin && groupId !== 2) {
      const sub = await api.groupSubscription(groupId);
      if (!hasEntitlement(sub, "hall_of_fame")) {
        return { ok: false, error: "Customizing the Hall of Fame requires a higher subscription tier." };
      }
    }
    const parsed = HofLayoutInputSchema.parse(input);
    const saved = await api.saveGroupHofLayout(groupId, parsed);
    revalidatePath(`/groups/${groupId}/hall-of-fame`);
    return { ok: true, data: saved };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

export async function resetHofLayoutAction(
  groupId: number,
): Promise<HofLayoutActionResult<null>> {
  try {
    if (!(await assertAdmin(groupId))) {
      return { ok: false, error: "Forbidden: you do not administer this group." };
    }
    await api.deleteGroupHofLayout(groupId);
    revalidatePath(`/groups/${groupId}/hall-of-fame`);
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

/** Render the draft for one boss. Not schema-checked here: a half-written
 * draft is the normal state while typing, and the backend answers it with
 * `errors` rather than a failure. */
export async function previewHofLayoutAction(
  groupId: number,
  input: HofLayoutInput,
  boss: string | null,
): Promise<HofLayoutActionResult<HofLayoutPreview>> {
  try {
    if (!(await assertAdmin(groupId))) {
      return { ok: false, error: "Forbidden: you do not administer this group." };
    }
    const preview = await api.previewGroupHofLayout(groupId, { ...input, boss });
    return { ok: true, data: preview };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}
