"use server";

/**
 * Conquest events (web120a) — the map designer's and live admin tools' Server
 * Actions. Kept apart from the big events actions module.
 *
 * Results ride the return value rather than throwing: Next redacts thrown
 * Server Action errors, and the Web API's reasons ("the map is locked once the
 * event starts", "someone else saved this map") are the whole message.
 * `groupId` null = a global event (site staff only).
 */
import { revalidatePath } from "next/cache";
import type {
  ConquestMap,
  ConquestMapInput,
  ConquestPresetOptions,
  ConquestSettings,
} from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { canManageEvents, getUser } from "@/lib/auth";

export type ConquestResult<T> = { ok: true; data: T } | { ok: false; message: string };

async function assertCanManage(groupId: number | null) {
  const user = await getUser();
  if (!user) throw new Error("Forbidden: sign in required.");
  if (groupId == null) {
    if (!user.is_superadmin) throw new Error("Forbidden: global events are managed by site staff.");
    return;
  }
  // The Web API is authoritative; this only stops obviously-unauthorised
  // callers early.
  if (!user.is_superadmin && !canManageEvents(user, groupId)) {
    throw new Error("Forbidden: you cannot manage this group's events.");
  }
}

function failed<T>(err: unknown, fallback: string): ConquestResult<T> {
  if (err instanceof ApiError) return { ok: false, message: err.message || fallback };
  throw err;
}

function revalidate(groupId: number | null, eventId: number) {
  revalidatePath(groupId == null ? `/admin/events/${eventId}` : `/groups/${groupId}/events/${eventId}`);
  revalidatePath(`/events/${eventId}`);
}

export async function fetchConquestMap(
  groupId: number | null,
  eventId: number,
): Promise<ConquestResult<ConquestMap>> {
  await assertCanManage(groupId);
  try {
    return { ok: true, data: await api.eventConquest(eventId) };
  } catch (err) {
    return failed(err, "Couldn't load the map.");
  }
}

export async function fetchConquestPresets(
  groupId: number | null,
  eventId: number,
): Promise<ConquestResult<ConquestPresetOptions>> {
  await assertCanManage(groupId);
  try {
    return { ok: true, data: await api.eventConquestPresets(eventId) };
  } catch (err) {
    return failed(err, "Couldn't load the map presets.");
  }
}

export async function saveConquestMap(
  groupId: number | null,
  eventId: number,
  input: ConquestMapInput,
): Promise<ConquestResult<ConquestMap>> {
  await assertCanManage(groupId);
  try {
    const map = await api.saveEventConquestMap(eventId, input);
    revalidate(groupId, eventId);
    return { ok: true, data: map };
  } catch (err) {
    return failed(err, "Couldn't save the map.");
  }
}

export async function applyConquestPreset(
  groupId: number | null,
  eventId: number,
  body: { preset: string; troop_hours?: number; unique_troops?: number },
): Promise<ConquestResult<ConquestMap>> {
  await assertCanManage(groupId);
  try {
    const map = await api.applyEventConquestPreset(eventId, body);
    revalidate(groupId, eventId);
    return { ok: true, data: map };
  } catch (err) {
    return failed(err, "Couldn't build the map.");
  }
}

export async function saveConquestSettings(
  groupId: number | null,
  eventId: number,
  patch: Partial<ConquestSettings>,
): Promise<ConquestResult<ConquestSettings>> {
  await assertCanManage(groupId);
  try {
    const settings = await api.patchEventConquestSettings(eventId, patch);
    revalidate(groupId, eventId);
    return { ok: true, data: settings };
  } catch (err) {
    return failed(err, "Couldn't save the settings.");
  }
}

export async function uploadConquestBackground(
  groupId: number | null,
  eventId: number,
  form: FormData,
): Promise<ConquestResult<{ background_url: string; bg_width: number; bg_height: number }>> {
  await assertCanManage(groupId);
  try {
    const res = await api.uploadEventConquestBackground(eventId, form);
    revalidate(groupId, eventId);
    return { ok: true, data: res };
  } catch (err) {
    return failed(err, "Couldn't upload the map image.");
  }
}

export async function clearConquestBackground(
  groupId: number | null,
  eventId: number,
): Promise<ConquestResult<null>> {
  await assertCanManage(groupId);
  try {
    await api.clearEventConquestBackground(eventId);
    revalidate(groupId, eventId);
    return { ok: true, data: null };
  } catch (err) {
    return failed(err, "Couldn't remove the map image.");
  }
}

export async function adjustConquestTile(
  groupId: number | null,
  eventId: number,
  tileId: number,
  body: { owner_team_id: number | null; defense?: number },
): Promise<ConquestResult<{ tile_id: number; owner_team_id: number | null; defense: number }>> {
  await assertCanManage(groupId);
  try {
    const res = await api.adjustEventConquestTile(eventId, tileId, body);
    revalidate(groupId, eventId);
    return { ok: true, data: res };
  } catch (err) {
    return failed(err, "Couldn't adjust the tile.");
  }
}
