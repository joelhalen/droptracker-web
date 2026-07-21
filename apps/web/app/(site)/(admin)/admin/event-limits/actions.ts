"use server";

import { revalidatePath } from "next/cache";
import type { AdminEventRateLimit } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

type PutResult = { ok: true; row: AdminEventRateLimit } | { ok: false; error: string };
type DeleteResult = { ok: true } | { ok: false; error: string };

/** Upsert one per-tier event frequency cap. Superadmin only. */
export async function putEventRateLimit(input: {
  tier_key: string;
  type_key: string;
  max_events: number;
  window_days: number;
  enabled?: boolean;
}): Promise<PutResult> {
  await requireSuperadmin("/admin/event-limits");
  try {
    const row = await api.adminPutEventRateLimit(input);
    revalidatePath("/admin/event-limits");
    return { ok: true as const, row };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message || "Save failed." };
  }
}

/** Delete one cap — that (tier, type) scope reverts to unlimited. */
export async function deleteEventRateLimit(id: number): Promise<DeleteResult> {
  await requireSuperadmin("/admin/event-limits");
  try {
    await api.adminDeleteEventRateLimit(id);
    revalidatePath("/admin/event-limits");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message || "Couldn't remove the rule." };
  }
}
