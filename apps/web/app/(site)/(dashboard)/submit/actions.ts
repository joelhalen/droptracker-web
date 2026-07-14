"use server";

import { ManualSubmissionSchema, type ManualSubmission } from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";

const ALLOWED_PROOF_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/**
 * Server Action: validate and forward a manual submission to the Web API.
 *
 * Returns a discriminated result instead of throwing: Next.js redacts thrown
 * Server Action errors in production, which would replace the pipeline's
 * useful rejection reasons ("Item X is not from NPC Y", "held for a group
 * admin to approve", …) with an opaque generic message.
 */
export async function submitDrop(
  input: ManualSubmission,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    const parsed = ManualSubmissionSchema.parse(input);
    const result = await api.manualSubmit(parsed);
    return { ok: true as const, id: result.id };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false as const, error: err.message };
    return { ok: false as const, error: "Couldn't submit. Check your inputs and try again." };
  }
}

/** Server Action: per-group manual-policy notices for a player (suggestion
 * #45, Phase 3) — the submit form warns before submitting to a clan that
 * holds/disables manual submissions. */
export async function manualPreflight(playerId: number) {
  return api.manualPreflight(playerId);
}

/** Server Action: item-name autocomplete for the submit form's pickers. */
export async function searchItems(q: string) {
  if (q.trim().length < 2) return [];
  return api.searchEventItems(q.trim());
}

/** Server Action: NPC/boss-name autocomplete for the submit form's pickers. */
export async function searchNpcs(q: string) {
  if (q.trim().length < 2) return [];
  return api.searchEventNpcs(q.trim());
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
