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
export async function fetchServiceLogs(unit: string) {
  await requireSuperadmin("/admin/services");
  return api.adminServiceLogs(unit);
}
