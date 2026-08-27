"use server";

import { revalidatePath } from "next/cache";
import type { ApiKey, ApiKeyTier } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

/**
 * Mutations for the Data API key admin page.
 *
 * All superadmin: each one either hands out access to player data or changes
 * what existing keys may do. The page itself only needs developer to *read*,
 * which is the same split /admin/event-limits uses.
 *
 * The uniform `{ ok }` result exists because these run from a client island —
 * a thrown server-action error reaches the browser as an opaque digest, so the
 * failure has to be returned as a value if the operator is to be told what
 * actually went wrong (e.g. "3 active keys still use this tier").
 */

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function failed(e: unknown, fallback: string): { ok: false; error: string } {
  const message = (e as Error)?.message?.trim();
  return { ok: false as const, error: message || fallback };
}

const PATH = "/admin/api-keys";

export async function mintApiKey(input: {
  owner_user_id?: number | null;
  group_id?: number | null;
  label?: string;
  tier?: string;
}): Promise<Result<ApiKey>> {
  await requireSuperadmin(PATH);
  try {
    const value = await api.adminMintApiKey(input);
    revalidatePath(PATH);
    return { ok: true as const, value };
  } catch (e) {
    return failed(e, "Could not create the key.");
  }
}

/** Promote a tier, set/clear an override (null clears), revoke or un-revoke. */
export async function updateApiKey(
  id: number,
  input: Record<string, unknown>,
): Promise<Result<ApiKey>> {
  await requireSuperadmin(PATH);
  try {
    const value = await api.adminUpdateApiKey(id, input);
    revalidatePath(PATH);
    return { ok: true as const, value };
  } catch (e) {
    return failed(e, "Could not update the key.");
  }
}

/** Create or update a tier. Applies to every key on it immediately. */
export async function putApiKeyTier(
  tierKey: string,
  input: Record<string, unknown>,
): Promise<Result<ApiKeyTier>> {
  await requireSuperadmin(PATH);
  try {
    const value = await api.adminPutApiKeyTier(tierKey, input);
    revalidatePath(PATH);
    return { ok: true as const, value };
  } catch (e) {
    return failed(e, "Could not save the tier.");
  }
}

/** Delete a tier. The backend refuses while live keys still reference it. */
export async function deleteApiKeyTier(tierKey: string): Promise<Result<null>> {
  await requireSuperadmin(PATH);
  try {
    await api.adminDeleteApiKeyTier(tierKey);
    revalidatePath(PATH);
    return { ok: true as const, value: null };
  } catch (e) {
    return failed(e, "Could not delete the tier.");
  }
}
