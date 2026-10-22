"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  BotProfileInputSchema,
  type BotProfile,
  type BotProfileImageKind,
  type BotProfileInput,
} from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";

/**
 * Server Actions for the bot appearance tab (web139a).
 *
 * Discriminated results rather than throws: Next redacts thrown Server Action
 * errors in production, and the editor needs the backend's own wording ("That
 * nickname could be mistaken for Discord...", "Try again in about 8 minutes").
 * The Web API enforces the custom_bot_profile entitlement on every write.
 */
export type BotProfileActionResult = { ok: true; data: BotProfile } | { ok: false; error: string };

function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

async function run(groupId: number, fn: () => Promise<BotProfile>): Promise<BotProfileActionResult> {
  try {
    const user = await getUser();
    if (!user || !canAdminGroup(user, groupId)) {
      return { ok: false, error: "Forbidden: you do not administer this group." };
    }
    const data = await fn();
    revalidatePath(`/groups/${groupId}/bot`);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

export async function getBotProfileAction(groupId: number): Promise<BotProfileActionResult> {
  return run(groupId, () => api.groupBotProfile(groupId));
}

export async function saveBotProfileAction(
  groupId: number,
  input: BotProfileInput,
): Promise<BotProfileActionResult> {
  return run(groupId, () => api.saveGroupBotProfile(groupId, BotProfileInputSchema.parse(input)));
}

export async function uploadBotImageAction(
  groupId: number,
  kind: BotProfileImageKind,
  form: FormData,
): Promise<BotProfileActionResult> {
  return run(groupId, () => api.uploadGroupBotImage(groupId, kind, form));
}

export async function removeBotImageAction(
  groupId: number,
  kind: BotProfileImageKind,
): Promise<BotProfileActionResult> {
  return run(groupId, () => api.removeGroupBotImage(groupId, kind));
}

export async function resetBotProfileAction(groupId: number): Promise<BotProfileActionResult> {
  return run(groupId, () => api.resetGroupBotProfile(groupId));
}
