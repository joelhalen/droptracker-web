"use server";

import { DiscordSendInputSchema, type DiscordSendInput } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

/** Server Action: send a message to a Discord channel via the bot. Superadmin. */
export async function sendDiscordMessage(input: DiscordSendInput) {
  await requireSuperadmin("/admin/discord");
  const parsed = DiscordSendInputSchema.parse(input);
  await api.adminSendDiscord(parsed);
  return { ok: true as const };
}
