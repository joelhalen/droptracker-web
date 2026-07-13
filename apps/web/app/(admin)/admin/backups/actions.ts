"use server";

import { revalidatePath } from "next/cache";
import type { BackupOffsite, ServiceLogs } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

/** Server Action: kick off a manual backup run. Superadmin only. */
export async function runBackupNow(): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperadmin("/admin/backups");
  try {
    await api.adminRunBackup();
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Could not start backup." };
  }
  revalidatePath("/admin/backups");
  return { ok: true as const };
}

/** Server Action: fetch recent journal logs for the backup unit. */
export async function fetchBackupLogs(): Promise<ServiceLogs> {
  await requireSuperadmin("/admin/backups");
  return api.adminBackupLogs();
}

/** Server Action: list the offsite (B2) backup copies. Network call — loaded lazily. */
export async function fetchOffsiteBackups(): Promise<
  { ok: true; data: BackupOffsite } | { ok: false; error: string }
> {
  await requireSuperadmin("/admin/backups");
  try {
    return { ok: true as const, data: await api.adminBackupOffsite() };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message || "Offsite check failed." };
  }
}
