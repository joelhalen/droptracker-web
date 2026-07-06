"use server";

import { revalidatePath } from "next/cache";
import {
  EMBED_TYPES,
  GroupEmbedInputSchema,
  type EmbedType,
  type GroupEmbed,
  type GroupEmbedInput,
} from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";
import { hasEntitlement } from "@/lib/entitlements";

function assertEmbedType(embedType: string): asserts embedType is EmbedType {
  if (!EMBED_TYPES.includes(embedType as EmbedType)) {
    throw new Error(`Unknown embed type '${embedType}'.`);
  }
}

/** Server Action: save a group's custom embed template for one notification type. */
export async function saveGroupEmbedAction(
  groupId: number,
  embedType: string,
  input: GroupEmbedInput,
): Promise<GroupEmbed> {
  assertEmbedType(embedType);
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  if (!user.is_superadmin) {
    const sub = await api.groupSubscription(groupId);
    if (!hasEntitlement(sub, "custom_embeds")) {
      throw new Error("Custom embeds require a higher subscription tier.");
    }
  }
  const parsed = GroupEmbedInputSchema.parse(input);

  try {
    const saved = await api.saveGroupEmbed(groupId, embedType, parsed);
    revalidatePath(`/groups/${groupId}/embeds`);
    return saved;
  } catch (err) {
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
}

/** Server Action: remove the custom template for one type (revert to the default). */
export async function resetGroupEmbedAction(
  groupId: number,
  embedType: string,
): Promise<{ ok: true }> {
  assertEmbedType(embedType);
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
  try {
    await api.deleteGroupEmbed(groupId, embedType);
  } catch (err) {
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
  revalidatePath(`/groups/${groupId}/embeds`);
  return { ok: true };
}
