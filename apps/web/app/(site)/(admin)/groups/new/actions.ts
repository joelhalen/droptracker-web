"use server";

import { CreateGroupInputSchema, type CreateGroupInput } from "@droptracker/api-types";
import { ApiError, api } from "@/lib/api";
import { canAdminGroup, getUser } from "@/lib/auth";

/**
 * Every wizard action returns `{ ok: true, ... } | { ok: false, message }`
 * instead of throwing. Production redacts errors THROWN from Server Actions
 * to an opaque digest, so a thrown "You do not manage the selected Discord
 * server" reached the wizard as a generic "Couldn't create the group" (ticket
 * 503). Callers unwrap with `unwrapActionResult` (lib/errors.ts), which
 * rethrows client-side where the message survives.
 */
type Failure = { ok: false; message: string };

function failure(err: unknown): Failure {
  if (err instanceof ApiError) return { ok: false, message: err.message };
  if (err instanceof Error && err.message) return { ok: false, message: err.message };
  return { ok: false, message: "Something went wrong. Please try again." };
}

async function assertSignedIn() {
  const user = await getUser();
  if (!user) throw new Error("You must be signed in to create a group.");
  return user;
}

async function assertGroupAdmin(groupId: number) {
  const user = await assertSignedIn();
  if (!canAdminGroup(user, groupId)) {
    // POST /groups seeds the creator as owner synchronously, but this
    // session's /me snapshot may predate creation: recheck a fresh one.
    const fresh = await getUser();
    if (!fresh || !canAdminGroup(fresh, groupId)) {
      throw new Error("Forbidden: you do not administer this group.");
    }
  }
}

/** Wizard step: the Discord servers the caller can manage (server picker). */
export async function fetchManageableGuilds() {
  try {
    await assertSignedIn();
    return { ok: true as const, data: await api.manageableGuilds() };
  } catch (err) {
    return failure(err);
  }
}

/** Wizard step: preview a Wise Old Man group + already-registered check. */
export async function lookupWom(womId: number) {
  try {
    await assertSignedIn();
    return { ok: true as const, data: await api.womLookup(womId) };
  } catch (err) {
    return failure(err);
  }
}

/** Wizard step: is the bot in the guild / does it already own a group.
 * `refresh` busts the backend presence cache (invite-the-bot polling). */
export async function checkGuild(guildId: string, opts?: { refresh?: boolean }) {
  try {
    await assertSignedIn();
    return { ok: true as const, data: await api.guildStatus(guildId, opts) };
  } catch (err) {
    return failure(err);
  }
}

/** Wizard step: public bot application info for the invite button. */
export async function fetchBotInvite() {
  try {
    return { ok: true as const, data: await api.botInvite() };
  } catch (err) {
    return failure(err);
  }
}

/** Create step: create the group (wraps backend `create_web_group`). */
export async function createGroup(input: CreateGroupInput) {
  try {
    await assertSignedIn();
    const parsed = CreateGroupInputSchema.parse(input);
    const result = await api.createGroup(parsed);
    // The code is shown once, by the wizard; nothing else can read it back.
    return {
      ok: true as const,
      data: { id: result.id, verification_code: result.verification_code ?? null },
    };
  } catch (err) {
    return failure(err);
  }
}

/** Channels step: the bot's cached channel list for the new group. */
export async function fetchWizardChannels(groupId: number) {
  try {
    await assertGroupAdmin(groupId);
    return { ok: true as const, data: await api.groupDiscordChannels(groupId) };
  } catch (err) {
    return failure(err);
  }
}

/** Channels step: save wizard config keys (channel ids). */
export async function saveWizardConfig(groupId: number, patch: Record<string, string | null>) {
  try {
    await assertGroupAdmin(groupId);
    await api.updateGroupConfig(groupId, patch);
    return { ok: true as const, data: null };
  } catch (err) {
    return failure(err);
  }
}

/** Features step: what the group can switch on, with its status. */
export async function fetchWizardFeatures(groupId: number) {
  try {
    await assertGroupAdmin(groupId);
    return { ok: true as const, data: await api.groupFeatures(groupId) };
  } catch (err) {
    return failure(err);
  }
}

/** Features step (and admin Overview): switch one feature on. */
export async function enableWizardFeature(groupId: number, key: string, channelId?: string | null) {
  try {
    await assertGroupAdmin(groupId);
    return { ok: true as const, data: await api.enableGroupFeature(groupId, key, channelId) };
  } catch (err) {
    return failure(err);
  }
}

/** Finish step: post the members' guide to a Discord channel. */
export async function postWizardMemberGuide(groupId: number, channelId: string) {
  try {
    await assertGroupAdmin(groupId);
    await api.postMemberGuide(groupId, channelId);
    return { ok: true as const, data: null };
  } catch (err) {
    return failure(err);
  }
}
