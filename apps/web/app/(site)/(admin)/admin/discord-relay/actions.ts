"use server";

import { revalidatePath } from "next/cache";
import type { DiscordRelayIntegration, DiscordRelayLog } from "@droptracker/api-types";
import { api } from "@/lib/api";
import type { DiscordRelayInput } from "@/lib/api/discord-relay";
import { requireDeveloper, requireSuperadmin } from "@/lib/auth";

/**
 * Mutations for the Discord relay admin page. All superadmin: each one changes
 * who posts in a group's server or hands out a key. Results are returned as
 * values because a thrown server-action error reaches the browser as an
 * opaque digest (same reasoning as /admin/api-keys).
 */

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function failed(e: unknown, fallback: string): { ok: false; error: string } {
  const message = (e as Error)?.message?.trim();
  return { ok: false as const, error: message || fallback };
}

const PATH = "/admin/discord-relay";

export async function createDiscordRelay(
  input: DiscordRelayInput,
): Promise<Result<DiscordRelayIntegration>> {
  await requireSuperadmin(PATH);
  try {
    const value = await api.adminCreateDiscordRelay(input);
    revalidatePath(PATH);
    return { ok: true as const, value };
  } catch (e) {
    return failed(e, "Could not create the relay.");
  }
}

export async function updateDiscordRelay(
  id: number,
  input: DiscordRelayInput,
): Promise<Result<DiscordRelayIntegration>> {
  await requireSuperadmin(PATH);
  try {
    const value = await api.adminUpdateDiscordRelay(id, input);
    revalidatePath(PATH);
    return { ok: true as const, value };
  } catch (e) {
    return failed(e, "Could not save the relay.");
  }
}

export async function rotateDiscordRelayKey(id: number): Promise<Result<DiscordRelayIntegration>> {
  await requireSuperadmin(PATH);
  try {
    const value = await api.adminRotateDiscordRelayKey(id);
    revalidatePath(PATH);
    return { ok: true as const, value };
  } catch (e) {
    return failed(e, "Could not replace the key.");
  }
}

export async function deleteDiscordRelay(id: number): Promise<Result<null>> {
  await requireSuperadmin(PATH);
  try {
    await api.adminDeleteDiscordRelay(id);
    revalidatePath(PATH);
    return { ok: true as const, value: null };
  } catch (e) {
    return failed(e, "Could not delete the relay.");
  }
}

/** Read-only, so developers may use it too. */
export async function loadDiscordRelayLog(id: number): Promise<Result<DiscordRelayLog>> {
  await requireDeveloper(PATH);
  try {
    return { ok: true as const, value: await api.adminDiscordRelayLog(id) };
  } catch (e) {
    return failed(e, "Could not load the delivery log.");
  }
}
