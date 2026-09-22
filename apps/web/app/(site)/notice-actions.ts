"use server";

/**
 * Server actions for targeted site pop-ups (web118a), driven by the
 * `SiteNotices` client island in the site chrome.
 *
 * Deliberately no `getUser()` round trip first: the backend answers 401 for a
 * missing session, which here just means "nothing to show". Who matches which
 * notice is entirely the backend's decision.
 */
import { z } from "zod";
import type { PopupNotice } from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";

const IdsSchema = z.array(z.number().int()).min(1).max(20);

export async function loadMyNotices(): Promise<PopupNotice[]> {
  try {
    return (await api.myNotices()).items;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return [];
    throw err;
  }
}

/** First time each notice was actually shown (staff see it as "seen"). */
export async function markNoticesSeen(ids: number[]): Promise<void> {
  await api.markNoticesSeen(IdsSchema.parse(ids));
}

/** Closed for good, on every device. */
export async function dismissNotices(ids: number[]): Promise<void> {
  await api.dismissNotices(IdsSchema.parse(ids));
}
