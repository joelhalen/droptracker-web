"use server";

import { revalidatePath } from "next/cache";
import type { ApiKeyRequest } from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { canAdminGroup, getUser } from "@/lib/auth";

/**
 * Data API access (web163a). Actions return `{ ok, ... }` instead of throwing:
 * thrown Server Action errors are redacted in production, and the backend's
 * wording ("This group already has a key request waiting for staff.") is the
 * message the person needs. Unwrap on the client with `unwrapActionResult`.
 *
 * `groupId` undefined means the caller's personal keys.
 */
type RequestResult = { ok: true; request: ApiKeyRequest } | { ok: false; message: string };
type DoneResult = { ok: true } | { ok: false; message: string };

function failed(err: unknown, fallback: string): { ok: false; message: string } {
  if (err instanceof ApiError && err.message) return { ok: false, message: err.message };
  return { ok: false, message: fallback };
}

function pathFor(groupId?: number): string {
  return groupId == null ? "/api-keys" : `/groups/${groupId}/api`;
}

async function mayAct(groupId?: number): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  return groupId == null || canAdminGroup(user, groupId);
}

export async function requestApiKey(
  input: { label: string; purpose: string },
  groupId?: number,
): Promise<RequestResult> {
  if (!(await mayAct(groupId))) {
    return { ok: false, message: "Only this group's admins can ask for its API key." };
  }
  try {
    const request =
      groupId == null
        ? await api.requestMyApiKey(input)
        : await api.requestGroupApiKey(groupId, input);
    revalidatePath(pathFor(groupId));
    return { ok: true, request };
  } catch (err) {
    return failed(err, "Couldn't send the request. Please try again.");
  }
}

export async function cancelApiKeyRequest(
  requestId: number,
  groupId?: number,
): Promise<RequestResult> {
  try {
    const request = await api.cancelApiKeyRequest(requestId);
    revalidatePath(pathFor(groupId));
    return { ok: true, request };
  } catch (err) {
    return failed(err, "Couldn't withdraw the request. Please try again.");
  }
}

export async function revokeApiKey(keyId: number, groupId?: number): Promise<DoneResult> {
  if (!(await mayAct(groupId))) {
    return { ok: false, message: "Only this group's admins can revoke its keys." };
  }
  try {
    if (groupId == null) await api.revokeMyApiKey(keyId);
    else await api.revokeGroupApiKey(groupId, keyId);
    revalidatePath(pathFor(groupId));
    return { ok: true };
  } catch (err) {
    return failed(err, "Couldn't revoke the key. Please try again.");
  }
}
