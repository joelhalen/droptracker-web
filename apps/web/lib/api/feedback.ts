import { apiGet, apiSend, withFallback } from "./_client";
import {
  AdminFeedbackOverviewSchema,
  AdminFeedbackRequestSchema,
  FeedbackGroupsSchema,
  FeedbackPromptSchema,
  type AdminFeedbackOverview,
  type AdminFeedbackRequest,
  type FeedbackAnswer,
  type FeedbackGroup,
  type FeedbackPrompt,
  type FeedbackRequestInput,
} from "@droptracker/api-types";
import { z } from "zod";

const SubmitResultSchema = z.object({ ok: z.literal(true), id: z.number().int() });

/**
 * Clan leader feedback (web155a). Visitor calls are session-scoped; every
 * `admin*` call is superadmin-gated by the backend.
 */
export const feedbackApi = {
  // --- Visitor -------------------------------------------------------------
  /** A live feedback request this user matches and hasn't answered. */
  async myFeedbackPrompt(): Promise<FeedbackPrompt> {
    return withFallback(
      async () => FeedbackPromptSchema.parse(await apiGet(`/me/feedback/prompt`, { authed: true })),
      () => ({ prompt: null, groups: [] }),
    );
  },

  /** Clans this user owns or admins (for the /feedback page). */
  async myFeedbackGroups(): Promise<FeedbackGroup[]> {
    return withFallback(
      async () =>
        FeedbackGroupsSchema.parse(await apiGet(`/me/feedback/groups`, { authed: true })).groups,
      () => [],
    );
  },

  async markFeedbackSeen(requestId: number): Promise<void> {
    await apiSend("POST", `/me/feedback/seen`, { request_id: requestId });
  },

  async snoozeFeedback(requestId: number, forever: boolean): Promise<void> {
    await apiSend("POST", `/me/feedback/snooze`, { request_id: requestId, forever });
  },

  async submitFeedback(answer: FeedbackAnswer): Promise<{ id: number }> {
    const out = SubmitResultSchema.parse(await apiSend("POST", `/me/feedback`, answer));
    return { id: out.id };
  },

  // --- Admin ---------------------------------------------------------------
  async adminFeedback(): Promise<AdminFeedbackOverview> {
    return withFallback(
      async () => AdminFeedbackOverviewSchema.parse(await apiGet(`/admin/feedback`, { authed: true })),
      () => ({ requests: [], responses: [], labels: { users: {}, groups: {}, tiers: {} } }),
    );
  },

  async adminCreateFeedbackRequest(
    input: FeedbackRequestInput & { send: boolean },
  ): Promise<AdminFeedbackRequest> {
    return AdminFeedbackRequestSchema.parse(await apiSend("POST", `/admin/feedback/requests`, input));
  },

  async adminUpdateFeedbackRequest(
    id: number,
    patch: Partial<FeedbackRequestInput>,
  ): Promise<AdminFeedbackRequest> {
    return AdminFeedbackRequestSchema.parse(
      await apiSend("PATCH", `/admin/feedback/requests/${id}`, patch),
    );
  },

  async adminSendFeedbackRequest(id: number): Promise<AdminFeedbackRequest> {
    return AdminFeedbackRequestSchema.parse(
      await apiSend("POST", `/admin/feedback/requests/${id}/send`, {}),
    );
  },

  async adminEndFeedbackRequest(id: number): Promise<AdminFeedbackRequest> {
    return AdminFeedbackRequestSchema.parse(
      await apiSend("POST", `/admin/feedback/requests/${id}/end`, {}),
    );
  },

  async adminDeleteFeedbackRequest(id: number): Promise<{ ok: true }> {
    await apiSend("DELETE", `/admin/feedback/requests/${id}`, {});
    return { ok: true } as const;
  },

  async adminRepostFeedback(id: number): Promise<{ ok: true }> {
    await apiSend("POST", `/admin/feedback/responses/${id}/repost`, {});
    return { ok: true } as const;
  },
};
