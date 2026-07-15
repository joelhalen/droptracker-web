"use server";

import { revalidatePath } from "next/cache";
import type { AdminShopItem } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

/** Edit a board-game shop catalog row (pricing/cooldown/copy/active). */
export async function patchShopItem(
  itemId: number,
  patch: Record<string, unknown>,
): Promise<{ ok: true; row: AdminShopItem } | { ok: false; error: string }> {
  await requireSuperadmin("/admin/boardgame-shop");
  try {
    const row = await api.adminPatchShopItem(itemId, patch);
    revalidatePath("/admin/boardgame-shop");
    return { ok: true as const, row };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message || "Update failed." };
  }
}
