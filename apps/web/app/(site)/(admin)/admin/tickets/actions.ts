"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

/** Server Action: claim/unclaim/close a ticket. Superadmin only.
 * Closing is asynchronous — the Discord bot archives the channel within
 * ~15s and flips the ticket to closed (status shows "closing" meanwhile). */
export async function ticketAction(
  ticketId: number,
  action: "claim" | "unclaim" | "close",
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperadmin("/admin/tickets");
  try {
    await api.adminTicketAction(ticketId, action);
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Failed to update the ticket." };
  }
  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${ticketId}`);
  return { ok: true as const };
}
