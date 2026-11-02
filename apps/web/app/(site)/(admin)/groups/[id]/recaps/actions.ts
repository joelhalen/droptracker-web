"use server";

import { revalidatePath } from "next/cache";
import { RecapDesignSchema, type RecapDesign, type RecapDesignResponse } from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { getUser, canAdminGroup } from "@/lib/auth";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function guard(groupId: number) {
  const user = await getUser();
  if (!user || !canAdminGroup(user, groupId)) {
    throw new Error("Forbidden: you do not administer this group.");
  }
}

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof ApiError) return { ok: false, error: err.message };
  return { ok: false, error: (err as Error)?.message ?? "Something went wrong" };
}

function refreshCard(groupId: number, period: string) {
  revalidatePath(`/groups/${groupId}/recaps`);
  if (period) revalidatePath(`/groups/${groupId}/recap/${period}`);
}

/** Save a design. `period` "" is the clan default for every month. */
export async function saveRecapDesign(
  groupId: number,
  period: string,
  design: RecapDesign,
  previewPeriod: string,
): Promise<Result<RecapDesignResponse>> {
  await guard(groupId);
  try {
    const data = await api.saveRecapDesign(groupId, period, RecapDesignSchema.parse(design));
    refreshCard(groupId, period || previewPeriod);
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

/** Drop one level: a month falls back to the clan default, the default to the built-in card. */
export async function resetRecapDesign(groupId: number, period: string, previewPeriod: string): Promise<Result<RecapDesignResponse>> {
  await guard(groupId);
  try {
    const data = await api.resetRecapDesign(groupId, period);
    refreshCard(groupId, period || previewPeriod);
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
}

export async function approveRecap(groupId: number, period: string, approved: boolean): Promise<Result> {
  await guard(groupId);
  try {
    await api.approveRecap(groupId, period, approved);
    revalidatePath(`/groups/${groupId}/recaps`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function refreshRecapPost(groupId: number, period: string): Promise<Result> {
  await guard(groupId);
  try {
    await api.refreshRecapPost(groupId, period);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function regenerateRecap(groupId: number, period: string): Promise<Result> {
  await guard(groupId);
  try {
    await api.regenerateRecap(groupId, period);
    refreshCard(groupId, period);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function setRecapReviewMode(groupId: number, mode: "off" | "notify" | "approve"): Promise<Result> {
  await guard(groupId);
  try {
    await api.updateGroupConfig(groupId, { recap_review_mode: mode });
    revalidatePath(`/groups/${groupId}/recaps`);
    revalidatePath(`/groups/${groupId}/settings`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
