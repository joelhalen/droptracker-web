"use server";

import { ManualSubmissionSchema, type ManualSubmission } from "@droptracker/api-types";
import { api } from "@/lib/api";

const ALLOWED_PROOF_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** Server Action: validate and forward a manual submission to the Web API. */
export async function submitDrop(input: ManualSubmission) {
  const parsed = ManualSubmissionSchema.parse(input);
  const result = await api.manualSubmit(parsed);
  return { ok: true as const, id: result.id };
}

/** Server Action: per-group manual-policy notices for a player (suggestion
 * #45, Phase 3) — the submit form warns before submitting to a clan that
 * holds/disables manual submissions. */
export async function manualPreflight(playerId: number) {
  return api.manualPreflight(playerId);
}

/**
 * Server Action: get a presigned B2 upload URL for proof-of-drop media. The
 * browser PUTs the file directly to `upload_url` (never through this server);
 * `key` is then passed back as `proof_upload_key` on the manual submission.
 */
export async function getUploadPresign(contentType: string) {
  if (!ALLOWED_PROOF_TYPES.has(contentType)) {
    throw new Error("Proof must be a PNG, JPEG, WebP, or GIF image.");
  }
  return api.uploadPresign(contentType);
}
