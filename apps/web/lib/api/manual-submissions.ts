import { apiGet, apiSend, apiSendForm, withFallback } from "./_client";
import {
  type ManualSubmission,
  type ManualPreflight,
  ManualPreflightSchema,
  type ManualSubmissionQueue,
  ManualSubmissionQueueSchema,
  type ManualSubmissionReviewResult,
  ManualSubmissionReviewResultSchema,
} from "@droptracker/api-types";
import {
  mockManualSubmissions,
} from "../mock-data";

export const manualSubmissionsApi = {

  async manualSubmit(input: ManualSubmission): Promise<{ id: number }> {
    return withFallback(
      async () => (await apiSend("POST", `/submissions/manual`, input)) as { id: number },
      () => ({ id: Math.floor(Math.random() * 100000) }),
    );
  },


  /** Per-group manual-policy notices for a player before submitting (Ph 3). */
  async manualPreflight(playerId: number): Promise<ManualPreflight> {
    return withFallback(
      async () =>
        ManualPreflightSchema.parse(
          await apiGet(`/submissions/manual/preflight?player_id=${playerId}`, { authed: true }),
        ),
      () => ({ notices: [] }),
    );
  },


  /** A group's manual-submission review queue (pending + recent). */
  async manualSubmissions(groupId: number): Promise<ManualSubmissionQueue> {
    return withFallback(
      async () =>
        ManualSubmissionQueueSchema.parse(
          await apiGet(`/groups/${groupId}/manual-submissions`, { authed: true }),
        ),
      () => mockManualSubmissions(),
    );
  },


  async approveManualSubmission(
    groupId: number,
    dropId: number,
  ): Promise<ManualSubmissionReviewResult> {
    return withFallback(
      async () =>
        ManualSubmissionReviewResultSchema.parse(
          await apiSend("POST", `/groups/${groupId}/manual-submissions/${dropId}/approve`, {}),
        ),
      () => ({ drop_id: dropId, group_id: groupId, status: "approved" as const }),
    );
  },


  async rejectManualSubmission(
    groupId: number,
    dropId: number,
  ): Promise<ManualSubmissionReviewResult> {
    return withFallback(
      async () =>
        ManualSubmissionReviewResultSchema.parse(
          await apiSend("POST", `/groups/${groupId}/manual-submissions/${dropId}/reject`, {}),
        ),
      () => ({ drop_id: dropId, group_id: groupId, status: "rejected" as const }),
    );
  },


  /**
   * Take back an approve/reject — the submission returns to the queue as
   * pending. Undoing an approval also debits its leaderboard credit back out
   * and removes the Discord announcement it released.
   */
  async undoManualSubmissionReview(
    groupId: number,
    dropId: number,
  ): Promise<ManualSubmissionReviewResult> {
    return withFallback(
      async () =>
        ManualSubmissionReviewResultSchema.parse(
          await apiSend("POST", `/groups/${groupId}/manual-submissions/${dropId}/undo`, {}),
        ),
      () => ({ drop_id: dropId, group_id: groupId, status: "pending" as const }),
    );
  },


  /**
   * Upload proof media (multipart 'file') for a manual submission. The Web API
   * stores it in B2 server-side and returns the object key + public CDN URL;
   * `key` is passed back as `proof_upload_key` on the submission. This replaces
   * a direct browser→B2 presigned PUT, which the bucket's CORS policy (GET/HEAD
   * only) rejected at preflight ("Failed to fetch").
   */
  async uploadProof(form: FormData): Promise<{ key: string; public_url: string }> {
    return withFallback(
      async () =>
        (await apiSendForm("POST", "/uploads/proof", form)) as {
          key: string;
          public_url: string;
        },
      () => ({ key: `dt_uploads/mock-${Date.now()}.png`, public_url: "" }),
    );
  },
};
