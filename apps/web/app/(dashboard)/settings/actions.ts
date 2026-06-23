"use server";

import { revalidatePath } from "next/cache";
import { AccountSettingsPatchSchema, type AccountSettingsPatch } from "@droptracker/api-types";
import { api } from "@/lib/api";

/** Server Action: validate and persist account-settings changes. */
export async function saveSettings(patch: AccountSettingsPatch) {
  const parsed = AccountSettingsPatchSchema.parse(patch);
  await api.updateSettings(parsed);
  revalidatePath("/settings");
  return { ok: true as const };
}
