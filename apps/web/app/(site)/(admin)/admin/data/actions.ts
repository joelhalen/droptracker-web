"use server";

import { revalidatePath } from "next/cache";
import { api, type AdminDataRecord } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

/** Server Action: load a single whitelisted record for the edit drawer. */
export async function fetchRecord(entity: string, id: string | number): Promise<AdminDataRecord> {
  await requireSuperadmin("/admin/data");
  return api.adminDataRecord(entity, id);
}

/** Server Action: patch the editable fields of a record. Superadmin only. */
export async function saveRecord(
  entity: string,
  id: string | number,
  fields: Record<string, unknown>,
) {
  await requireSuperadmin("/admin/data");
  await api.adminDataUpdate(entity, id, fields);
  revalidatePath("/admin/data");
  return { ok: true as const };
}
