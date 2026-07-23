"use server";

import { CreateGroupInputSchema, type CreateGroupInput } from "@droptracker/api-types";
import { ApiError, api } from "@/lib/api";
import { canAdminGroup, getUser } from "@/lib/auth";

async function assertSignedIn() {
  const user = await getUser();
  if (!user) throw new Error("You must be signed in to create a group.");
  return user;
}

/** Prod server actions redact thrown errors — unwrap ApiError so the wizard
 * shows the backend's RFC-7807 detail instead of an opaque digest. */
function unwrap(err: unknown): never {
  if (err instanceof ApiError) throw new Error(err.message);
  throw err;
}

/** Wizard step: the Discord servers the caller can manage (server picker). */
export async function fetchManageableGuilds() {
  await assertSignedIn();
  try {
    return await api.manageableGuilds();
  } catch (err) {
    unwrap(err);
  }
}

/** Wizard step: preview a Wise Old Man group + already-registered check. */
export async function lookupWom(womId: number) {
  await assertSignedIn();
  try {
    return await api.womLookup(womId);
  } catch (err) {
    unwrap(err);
  }
}

/** Wizard step: is the bot in the guild / does it already own a group.
 * `refresh` busts the backend presence cache (invite-the-bot polling). */
export async function checkGuild(guildId: string, opts?: { refresh?: boolean }) {
  await assertSignedIn();
  try {
    return await api.guildStatus(guildId, opts);
  } catch (err) {
    unwrap(err);
  }
}

/** Wizard step: public bot application info for the invite button. */
export async function fetchBotInvite() {
  try {
    return await api.botInvite();
  } catch (err) {
    unwrap(err);
  }
}

/** Create step: create the group (wraps backend `create_web_group`). */
export async function createGroup(input: CreateGroupInput) {
  await assertSignedIn();
  const parsed = CreateGroupInputSchema.parse(input);
  try {
    const result = await api.createGroup(parsed);
    return { ok: true as const, id: result.id };
  } catch (err) {
    unwrap(err);
  }
}

/** Channels step: the bot's cached channel list for the new group. */
export async function fetchWizardChannels(groupId: number) {
  const user = await assertSignedIn();
  // POST /groups seeds the creator as owner synchronously, but this session's
  // /me snapshot may predate creation — recheck against a fresh one.
  if (!canAdminGroup(user, groupId)) {
    const fresh = await getUser();
    if (!fresh || !canAdminGroup(fresh, groupId)) {
      throw new Error("Forbidden: you do not administer this group.");
    }
  }
  try {
    return await api.groupDiscordChannels(groupId);
  } catch (err) {
    unwrap(err);
  }
}

/** Channels step: save wizard config keys (channel ids). */
export async function saveWizardConfig(groupId: number, patch: Record<string, string | null>) {
  const user = await assertSignedIn();
  if (!canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  try {
    await api.updateGroupConfig(groupId, patch);
    return { ok: true as const };
  } catch (err) {
    unwrap(err);
  }
}
