"use server";

import { revalidatePath } from "next/cache";
import {
  AccountSettingsPatchSchema,
  type AccountSettings,
  type AccountSettingsPatch,
  type MyDeathMessages,
  type MyNitroBoost,
  type NotificationPrefs,
} from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";

/** Server Action: validate and persist account-settings changes. */
export async function saveSettings(patch: AccountSettingsPatch) {
  const parsed = AccountSettingsPatchSchema.parse(patch);
  await api.updateSettings(parsed);
  revalidatePath("/settings");
  return { ok: true as const };
}

/** Server Action: toggle one linked account's public visibility. */
export async function setPlayerHidden(
  playerId: number,
  hidden: boolean,
): Promise<AccountSettings> {
  const settings = await api.setMyPlayerHidden(playerId, hidden);
  revalidatePath("/settings");
  return settings;
}

/** Server Action: choose which group a Discord Nitro boost supports
 * (null = auto-pick). */
export async function setNitroBoostGroup(groupId: number | null): Promise<MyNitroBoost> {
  const nitro = await api.setMyNitroBoost(groupId);
  revalidatePath("/settings");
  return nitro;
}

/** Server Action: replace one linked account's in-game notification prefs. */
export async function savePlayerNotificationPrefs(
  playerId: number,
  prefs: Record<string, boolean>,
): Promise<NotificationPrefs> {
  const next = await api.setPlayerNotificationPrefs(playerId, prefs);
  revalidatePath("/settings");
  return next;
}

/** Server Action: replace one linked account's own death messages.
 *
 * Returns the refusal instead of throwing it: production redacts a thrown
 * Server Action message, and "Messages can't contain links." is exactly the
 * text the member needs to see. */
export async function saveMyDeathMessages(
  playerId: number,
  messages: string[],
): Promise<{ ok: true; data: MyDeathMessages } | { ok: false; error: string }> {
  try {
    const data = await api.setMyDeathMessages(playerId, messages);
    revalidatePath("/settings");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 422 || err.status === 404)) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}
