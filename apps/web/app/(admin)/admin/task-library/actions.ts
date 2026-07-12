"use server";

import { revalidatePath } from "next/cache";
import {
  EventTaskLibraryItemInputSchema,
  EventTaskLibraryItemPatchSchema,
  type EventTaskLibraryItemInput,
  type EventTaskLibraryItemPatch,
} from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

/** Search the whole library (superadmin sees every row, public + private). */
export async function searchTaskLibrary(
  params: { query?: string; type?: string; page?: number } = {},
) {
  await requireSuperadmin("/admin/task-library");
  return api.eventTaskLibrary(params);
}

/** Create a curated site-wide preset. */
export async function createTaskPreset(input: EventTaskLibraryItemInput) {
  await requireSuperadmin("/admin/task-library");
  const parsed = EventTaskLibraryItemInputSchema.parse(input);
  try {
    const item = await api.adminCreateEventTaskLibraryItem(parsed);
    revalidatePath("/admin/task-library");
    return { ok: true as const, item };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Couldn't create the preset." };
  }
}

/** Edit any preset (curated or clan-saved); absent keys stay unchanged. */
export async function updateTaskPreset(itemId: number, patch: EventTaskLibraryItemPatch) {
  await requireSuperadmin("/admin/task-library");
  const parsed = EventTaskLibraryItemPatchSchema.parse(patch);
  try {
    const item = await api.adminUpdateEventTaskLibraryItem(itemId, parsed);
    revalidatePath("/admin/task-library");
    return { ok: true as const, item };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Couldn't save the preset." };
  }
}

/** Soft-delete a preset (leaves every picker; copies in events untouched). */
export async function deleteTaskPreset(itemId: number) {
  await requireSuperadmin("/admin/task-library");
  try {
    await api.adminDeleteEventTaskLibraryItem(itemId);
    revalidatePath("/admin/task-library");
    return { ok: true as const };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Couldn't delete the preset." };
  }
}

/** Item-name autocomplete for the preset goal picker. */
export async function searchLibraryItems(q: string) {
  await requireSuperadmin("/admin/task-library");
  if (q.trim().length < 2) return [];
  return api.searchEventItems(q.trim());
}

/** NPC-name autocomplete for the preset goal picker. */
export async function searchLibraryNpcs(q: string) {
  await requireSuperadmin("/admin/task-library");
  if (q.trim().length < 2) return [];
  return api.searchEventNpcs(q.trim());
}

/** Batch exact-name → game-id lookup (icon hydration for stored lists). */
export async function resolveLibraryMeta(kind: "item" | "npc", names: string[]) {
  await requireSuperadmin("/admin/task-library");
  return api.resolveEventMeta(kind, names);
}
