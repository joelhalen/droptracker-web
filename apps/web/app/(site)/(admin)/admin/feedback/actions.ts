"use server";

/**
 * Server actions for /admin/feedback (web155a). Superadmin only: mutations
 * re-assert it here, and the backend enforces it on every route regardless.
 * The audience count and pickers are the pop-up notice ones.
 */
import { revalidatePath } from "next/cache";
import {
  FeedbackRequestInputSchema,
  type AdminFeedbackRequest,
  type FeedbackRequestInput,
} from "@droptracker/api-types";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";

const PATH = "/admin/feedback";

export async function createFeedbackRequest(
  input: FeedbackRequestInput,
  send: boolean,
): Promise<AdminFeedbackRequest> {
  await requireSuperadmin(PATH);
  const created = await api.adminCreateFeedbackRequest({
    ...FeedbackRequestInputSchema.parse(input),
    send: send === true,
  });
  revalidatePath(PATH);
  return created;
}

export async function updateFeedbackRequest(
  id: number,
  input: FeedbackRequestInput,
): Promise<AdminFeedbackRequest> {
  await requireSuperadmin(PATH);
  const updated = await api.adminUpdateFeedbackRequest(id, FeedbackRequestInputSchema.parse(input));
  revalidatePath(PATH);
  return updated;
}

export async function sendFeedbackRequest(id: number): Promise<AdminFeedbackRequest> {
  await requireSuperadmin(PATH);
  const sent = await api.adminSendFeedbackRequest(id);
  revalidatePath(PATH);
  return sent;
}

export async function endFeedbackRequest(id: number): Promise<AdminFeedbackRequest> {
  await requireSuperadmin(PATH);
  const ended = await api.adminEndFeedbackRequest(id);
  revalidatePath(PATH);
  return ended;
}

export async function deleteFeedbackRequest(id: number): Promise<{ ok: true }> {
  await requireSuperadmin(PATH);
  const out = await api.adminDeleteFeedbackRequest(id);
  revalidatePath(PATH);
  return out;
}

export async function repostFeedback(id: number): Promise<{ ok: true }> {
  await requireSuperadmin(PATH);
  return api.adminRepostFeedback(id);
}
