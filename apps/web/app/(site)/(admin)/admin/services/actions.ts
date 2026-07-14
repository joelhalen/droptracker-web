"use server";

import { revalidatePath } from "next/cache";
import { ServiceActionSchema, type ServiceAction } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

/** Server Action: start/stop/restart a backend service unit. Superadmin only. */
export async function runServiceAction(
  unit: string,
  action: ServiceAction["action"],
  confirm = false,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperadmin("/admin/services");
  ServiceActionSchema.parse({ action });
  try {
    await api.adminServiceAction(unit, action, confirm);
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Action failed." };
  }
  revalidatePath("/admin/services");
  return { ok: true as const };
}

/** Server Action: fetch recent journal logs for a unit. */
export async function fetchServiceLogs(unit: string, lines = 200) {
  await requireSuperadmin("/admin/services");
  return api.adminServiceLogs(unit, lines);
}

/** Server Action: re-poll live unit statuses (drives the panel's auto-refresh). */
export async function refreshServices() {
  await requireSuperadmin("/admin/services");
  return api.adminServices();
}

/** Server Action: toggle global seasonal-world submission processing. */
export async function setSeasonalActive(
  active: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperadmin("/admin/services");
  try {
    await api.adminSetSeasonal(Boolean(active));
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Toggle failed." };
  }
  revalidatePath("/admin/services");
  return { ok: true as const };
}
