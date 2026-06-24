"use server";

import { ManualSubmissionSchema, type ManualSubmission } from "@droptracker/api-types";
import { api } from "@/lib/api";

/** Server Action: validate and forward a manual submission to the Web API. */
export async function submitDrop(input: ManualSubmission) {
  const parsed = ManualSubmissionSchema.parse(input);
  const result = await api.manualSubmit(parsed);
  return { ok: true as const, id: result.id };
}
