"use server";

import { CreateGroupInputSchema, type CreateGroupInput } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

async function assertSignedIn() {
  const user = await getUser();
  if (!user) throw new Error("You must be signed in to create a group.");
  return user;
}

/** Wizard step: preview a Wise Old Man group + already-registered check. */
export async function lookupWom(womId: number) {
  await assertSignedIn();
  return api.womLookup(womId);
}

/** Wizard step: is the bot in the guild / does it already own a group. */
export async function checkGuild(guildId: string) {
  await assertSignedIn();
  return api.guildStatus(guildId);
}

/** Final step: create the group (wraps backend `create_web_group`). */
export async function createGroup(input: CreateGroupInput) {
  await assertSignedIn();
  const parsed = CreateGroupInputSchema.parse(input);
  const result = await api.createGroup(parsed);
  return { ok: true as const, id: result.id };
}
