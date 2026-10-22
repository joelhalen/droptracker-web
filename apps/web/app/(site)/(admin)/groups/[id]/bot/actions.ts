"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  BOT_PROFILE_IMAGE_KINDS,
  BotProfileInputSchema,
  type BotProfile,
  type BotProfileInput,
} from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";

/**
 * Server Actions for the bot appearance tab (web139a).
 *
 * Nothing reaches Discord until the group presses Save: images picked in the
 * editor stay in the browser until then. A save uploads any new images first
 * (the upload endpoint only stages them) and then sends the whole look in one
 * request.
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

/**
 * Save the whole look. The form carries `nick` and `bio` (empty = the bot's
 * own), and per image kind either `<kind>_file` (a new image), or
 * `<kind>_mode` of "keep" (leave as saved) or "default" (use the bot's own).
 */
export async function saveBotProfileAction(groupId: number, form: FormData): Promise<BotProfileActionResult> {
  return run(groupId, async () => {
    const text = (key: string) => {
      const v = form.get(key);
      return typeof v === "string" && v.trim() ? v : null;
    };
    const input: BotProfileInput = { nick: text("nick"), bio: text("bio") };
    for (const kind of BOT_PROFILE_IMAGE_KINDS) {
      const file = form.get(`${kind}_file`);
      if (file instanceof Blob && file.size > 0) {
        const upload = new FormData();
        upload.append("file", file, `${kind}.webp`);
        input[`${kind}_url`] = (await api.uploadGroupBotImage(groupId, kind, upload)).url;
      } else if (form.get(`${kind}_mode`) === "default") {
        input[`${kind}_url`] = null;
      }
    }
    return api.saveGroupBotProfile(groupId, BotProfileInputSchema.parse(input));
  });
}

export async function resetBotProfileAction(groupId: number): Promise<BotProfileActionResult> {
  return run(groupId, () => api.resetGroupBotProfile(groupId));
}
