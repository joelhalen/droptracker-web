"use server";

import { revalidatePath } from "next/cache";
import type {
  PointsBehavior,
  PointRule,
} from "@droptracker/api-types";
import { api } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";

async function assertAdmin(groupId: number) {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
}

function revalidate(groupId: number) {
  revalidatePath(`/groups/${groupId}/points/manage`);
}

// --- Settings ---------------------------------------------------------------
export async function savePointsSettings(
  groupId: number,
  patch: { rules?: Partial<PointRule>[]; behavior?: Partial<PointsBehavior> },
) {
  await assertAdmin(groupId);
  const result = await api.updateGroupPointsSettings(groupId, patch);
  revalidate(groupId);
  return result;
}

// --- Item/NPC overrides -----------------------------------------------------
export async function addPointMod(groupId: number, body: unknown) {
  await assertAdmin(groupId);
  const mods = await api.createGroupPointMod(groupId, body);
  revalidate(groupId);
  return mods;
}

export async function editPointMod(groupId: number, modId: number, body: unknown) {
  await assertAdmin(groupId);
  const mods = await api.updateGroupPointMod(groupId, modId, body);
  revalidate(groupId);
  return mods;
}

export async function removePointMod(groupId: number, modId: number) {
  await assertAdmin(groupId);
  const mods = await api.deleteGroupPointMod(groupId, modId);
  revalidate(groupId);
  return mods;
}

// --- Include/exclude lists ----------------------------------------------------
export async function addPointListEntry(groupId: number, body: unknown) {
  await assertAdmin(groupId);
  const entries = await api.createGroupPointListEntry(groupId, body);
  revalidate(groupId);
  return entries;
}

export async function removePointListEntry(groupId: number, entryId: number) {
  await assertAdmin(groupId);
  const entries = await api.deleteGroupPointListEntry(groupId, entryId);
  revalidate(groupId);
  return entries;
}

// --- Timed boosts -------------------------------------------------------------
export async function addPointBoost(groupId: number, body: unknown) {
  await assertAdmin(groupId);
  const boosts = await api.createGroupPointBoost(groupId, body);
  revalidate(groupId);
  return boosts;
}

export async function removePointBoost(groupId: number, boostId: number) {
  await assertAdmin(groupId);
  const boosts = await api.deleteGroupPointBoost(groupId, boostId);
  revalidate(groupId);
  return boosts;
}

// --- Seasons ------------------------------------------------------------------
export async function addPointSeason(
  groupId: number,
  body: { name: string; start_at: string; end_at: string },
) {
  await assertAdmin(groupId);
  const season = await api.createGroupPointSeason(groupId, body);
  revalidate(groupId);
  return season;
}

export async function removePointSeason(groupId: number, seasonId: number) {
  await assertAdmin(groupId);
  await api.deleteGroupPointSeason(groupId, seasonId);
  revalidate(groupId);
}

// --- Manual adjustments, history, reset ----------------------------------------
export async function adjustPoints(
  groupId: number,
  body: { player_id: number; amount: number; reason: string },
) {
  await assertAdmin(groupId);
  const result = await api.adjustGroupPoints(groupId, body);
  revalidate(groupId);
  return result;
}

export async function loadPointsHistory(
  groupId: number,
  params: { player_id?: number; manual?: boolean; page?: number; limit?: number } = {},
) {
  await assertAdmin(groupId);
  return api.groupPointsHistory(groupId, params);
}

export async function resetGroupPoints(groupId: number) {
  await assertAdmin(groupId);
  const result = await api.resetGroupPoints(groupId);
  revalidate(groupId);
  return result;
}

// --- Autocomplete helpers -------------------------------------------------------
export async function searchPointItems(groupId: number, q: string) {
  await assertAdmin(groupId);
  return api.searchEventItems(q.trim());
}

export async function searchPointNpcs(groupId: number, q: string) {
  await assertAdmin(groupId);
  return api.searchEventNpcs(q.trim());
}

/** Player-name search for the manual adjustment form (site-wide; the backend
 * rejects targets that aren't members of this group). */
export async function searchPointPlayers(groupId: number, q: string) {
  await assertAdmin(groupId);
  const results = await api.search(q.trim());
  return results.players.map((p) => ({ id: p.id, name: p.name }));
}
