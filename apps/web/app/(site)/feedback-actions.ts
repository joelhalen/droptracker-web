"use server";

/**
 * Server actions for clan leader feedback (web155a): the `FeedbackPrompt`
 * card in the site chrome and the /feedback page.
 *
 * No `getUser()` round trip first: the backend answers 401 for a missing
 * session, which for the card just means "nothing to ask".
 */
import { z } from "zod";
import { FeedbackAnswerSchema, type FeedbackAnswer, type FeedbackPrompt } from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";

const IdSchema = z.number().int();

export async function loadFeedbackPrompt(): Promise<FeedbackPrompt> {
  try {
    return await api.myFeedbackPrompt();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return { prompt: null, groups: [] };
    throw err;
  }
}

export async function markFeedbackSeen(requestId: number): Promise<void> {
  await api.markFeedbackSeen(IdSchema.parse(requestId));
}

/** "Not now" (back in 14 days) or "Don't ask again" (`forever`). */
export async function snoozeFeedback(requestId: number, forever: boolean): Promise<void> {
  await api.snoozeFeedback(IdSchema.parse(requestId), forever === true);
}

export type SubmitFeedbackResult = { ok: true } | { ok: false; error: string };

export async function submitFeedback(answer: FeedbackAnswer): Promise<SubmitFeedbackResult> {
  const parsed = FeedbackAnswerSchema.safeParse(answer);
  if (!parsed.success) return { ok: false, error: "Something in the form isn't right. Please check it." };
  try {
    await api.submitFeedback(parsed.data);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409) return { ok: true }; // already answered: nothing to redo
      if (err.status === 429) return { ok: false, error: "That's a lot of feedback for one hour. Try again later." };
      if (err.status === 401) return { ok: false, error: "Please sign in again to send this." };
    }
    return { ok: false, error: "Couldn't send that. Please try again." };
  }
}
