"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  EMBED_TYPES,
  GroupEmbedInputSchema,
  type EmbedType,
  type GroupEmbed,
  type GroupEmbedInput,
} from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";
import { hasEntitlement } from "@/lib/entitlements";

/**
 * Next.js redacts messages of errors thrown from Server Actions in
 * production, so these actions return a discriminated result instead of
 * throwing — the editor needs the real backend detail (validation problems,
 * entitlement failures) to show the user.
 */
export type EmbedActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

function assertEmbedType(embedType: string): asserts embedType is EmbedType {
  if (!EMBED_TYPES.includes(embedType as EmbedType)) {
    throw new Error(`Unknown embed type '${embedType}'.`);
  }
}

/** Server Action: save a group's custom embed template for one notification type. */
export async function saveGroupEmbedAction(
  groupId: number,
  embedType: string,
  input: GroupEmbedInput,
): Promise<EmbedActionResult<GroupEmbed>> {
  try {
    assertEmbedType(embedType);
    const user = await getUser();
    if (!user || !canAdminGroup(user, groupId)) {
      return { ok: false, error: "Forbidden: you do not administer this group." };
    }
    if (!user.is_superadmin) {
      const sub = await api.groupSubscription(groupId);
      if (!hasEntitlement(sub, "custom_embeds")) {
        return { ok: false, error: "Custom embeds require a higher subscription tier." };
      }
    }
    const parsed = GroupEmbedInputSchema.parse(input);
    const saved = await api.saveGroupEmbed(groupId, embedType, parsed);
    revalidatePath(`/groups/${groupId}/embeds`);
    return { ok: true, data: saved };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

/** Server Action: remove the custom template for one type (revert to the default). */
export async function resetGroupEmbedAction(
  groupId: number,
  embedType: string,
): Promise<EmbedActionResult<null>> {
  try {
    assertEmbedType(embedType);
    const user = await getUser();
    if (!user || !canAdminGroup(user, groupId)) {
      return { ok: false, error: "Forbidden: you do not administer this group." };
    }
    await api.deleteGroupEmbed(groupId, embedType);
    revalidatePath(`/groups/${groupId}/embeds`);
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}
