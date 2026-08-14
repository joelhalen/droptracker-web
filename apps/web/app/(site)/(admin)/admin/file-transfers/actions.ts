"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { requireDeveloper } from "@/lib/auth";

/**
 * Delete a transfer and every version's stored object ahead of its expiry.
 *
 * Irreversible: the files are in B2 only, which nothing backs up, and the row
 * is the only record of the object keys. The backend re-checks the staff role;
 * this guard is what stops a non-staff caller reaching it at all.
 */
export async function deleteFileTransfer(transferId: number) {
  await requireDeveloper("/admin/file-transfers");
  if (!Number.isInteger(transferId)) throw new Error("Bad transfer id.");
  await api.deleteFileTransfer(transferId);
  revalidatePath("/admin/file-transfers");
}
