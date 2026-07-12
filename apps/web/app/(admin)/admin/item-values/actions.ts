"use server";

import { revalidatePath } from "next/cache";
import {
  ItemValueOverrideInputSchema,
  type ItemValueOverrideInput,
  type ItemSearchResult,
} from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

/** Create (no id) or update (id) an item-value override. Superadmin only. */
export async function saveItemValue(input: ItemValueOverrideInput, id?: number) {
  await requireSuperadmin("/admin/item-values");
  const parsed = ItemValueOverrideInputSchema.parse(input);
  try {
    if (id != null) {
      await api.adminUpdateItemValue(id, parsed);
    } else {
      await api.adminCreateItemValue(parsed);
    }
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Failed to save item value" };
  }
  revalidatePath("/admin/item-values");
  revalidatePath("/item-values");
  return { ok: true as const };
}

export async function deleteItemValue(id: number) {
  await requireSuperadmin("/admin/item-values");
  try {
    await api.adminDeleteItemValue(id);
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Failed to delete item value" };
  }
  revalidatePath("/admin/item-values");
  revalidatePath("/item-values");
  return { ok: true as const };
}

/** Resolve an item name → id for the target/component pickers. */
export async function searchItems(q: string): Promise<ItemSearchResult[]> {
  await requireSuperadmin("/admin/item-values");
  if (q.trim().length < 2) return [];
  return api.adminItemSearch(q);
}
