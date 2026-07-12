"use server";

import { revalidatePath } from "next/cache";
import type { PbBlockSearchResult } from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

const PATH = "/admin/personal-bests";

/** Search npc_list for bosses to block (with PB-row impact + current state). */
export async function searchBosses(q: string): Promise<PbBlockSearchResult[]> {
  await requireSuperadmin(PATH);
  const res = await api.adminPbBlockSearch(q);
  return res.results;
}

/**
 * Block a boss (all its variant ids) and permanently purge its PB rows.
 * `confirm` is always true here — the client's hard-confirm modal gates it, and
 * the backend also refuses (409) without it.
 */
export async function addBlock(npcIds: number[], confirm: boolean) {
  await requireSuperadmin(PATH);
  try {
    const res = await api.adminAddPbBlock(npcIds, confirm);
    revalidatePath(PATH);
    return { ok: true as const, deleted: res.deleted_pb ?? 0, bosses: res.bosses };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Failed to block NPC" };
  }
}

/** Unblock a boss. Already-deleted rows are NOT restored. */
export async function removeBlock(npcId: number) {
  await requireSuperadmin(PATH);
  try {
    await api.adminRemovePbBlock(npcId);
    revalidatePath(PATH);
    return { ok: true as const };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Failed to unblock NPC" };
  }
}
