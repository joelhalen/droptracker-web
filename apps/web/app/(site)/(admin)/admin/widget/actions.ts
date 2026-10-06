"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import type { PairedWidgetDevice, WidgetDevice } from "@/lib/api/admin-widget";
import { requireSuperadmin } from "@/lib/auth";

export async function pairWidgetDevice(label: string): Promise<PairedWidgetDevice> {
  await requireSuperadmin("/admin/widget");
  const paired = await api.adminPairWidgetDevice(label.trim().slice(0, 64));
  revalidatePath("/admin/widget");
  return paired;
}

export async function revokeWidgetDevice(id: number): Promise<WidgetDevice> {
  await requireSuperadmin("/admin/widget");
  const revoked = await api.adminRevokeWidgetDevice(id);
  revalidatePath("/admin/widget");
  return revoked;
}
