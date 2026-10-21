"use server";

import { revalidatePath } from "next/cache";
import type { DataRemovalRequest } from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { getUser, isGroupOwner } from "@/lib/auth";

/**
 * Data removal (web137a). Every action returns `{ ok, ... }` rather than
 * throwing: thrown Server Action errors are redacted in production, and the
 * backend's wording ("Type the account name exactly as shown: …") is the
 * whole point of the message. Unwrap on the client with `unwrapActionResult`.
 */
type Result = { ok: true; request: DataRemovalRequest } | { ok: false; message: string };

function failed(err: unknown, fallback: string): Result {
  if (err instanceof ApiError && err.message) return { ok: false, message: err.message };
  return { ok: false, message: fallback };
}

export async function requestPlayerRemoval(playerId: number, confirmName: string): Promise<Result> {
  try {
    const request = await api.requestPlayerRemoval(playerId, confirmName);
    revalidatePath("/settings");
    return { ok: true, request };
  } catch (err) {
    return failed(err, "Couldn't send the removal request. Please try again.");
  }
}

export async function cancelDataRemoval(requestId: number, groupId?: number): Promise<Result> {
  try {
    const request = await api.cancelDataRemoval(requestId);
    revalidatePath("/settings");
    if (groupId != null) revalidatePath(`/groups/${groupId}/authorized`);
    return { ok: true, request };
  } catch (err) {
    return failed(err, "Couldn't cancel the request. Please try again.");
  }
}

export async function requestGroupRemoval(groupId: number, confirmName: string): Promise<Result> {
  const user = await getUser();
  if (!user || !isGroupOwner(user, groupId)) {
    return { ok: false, message: "Only this group's owner can ask for it to be removed." };
  }
  try {
    const request = await api.requestGroupRemoval(groupId, confirmName);
    revalidatePath(`/groups/${groupId}/authorized`);
    return { ok: true, request };
  } catch (err) {
    return failed(err, "Couldn't send the removal request. Please try again.");
  }
}
