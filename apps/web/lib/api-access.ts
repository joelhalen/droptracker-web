/**
 * Pure shaping for the API access panels (web163a): what a key request's
 * state means in words, and which request a panel should lead with.
 */
import type { ApiKey, ApiKeyRequest } from "@droptracker/api-types";

export const PURPOSE_MIN = 20;
export const PURPOSE_MAX = 1000;
export const LABEL_MAX = 64;

/** One line saying where a request stands, written for the person who asked. */
export function requestStatusText(req: ApiKeyRequest): string {
  switch (req.status) {
    case "pending":
      return "Waiting for DropTracker staff. They reply in the ticket, usually within a day.";
    case "approved":
      return req.claim_url
        ? "Approved. Collect the key with the button below: it is shown once."
        : "Approved. The key has been collected, or its link expired.";
    case "denied":
      return "Declined. Staff explained why in the ticket; you can ask again.";
    case "cancelled":
      return "Withdrawn.";
  }
}

/** The request to show at the top: a pending one, else an approved one whose
 *  key is still waiting to be collected. Older history is not a headline. */
export function headlineRequest(requests: ApiKeyRequest[]): ApiKeyRequest | null {
  return (
    requests.find((r) => r.status === "pending") ??
    requests.find((r) => r.status === "approved" && r.claim_url) ??
    null
  );
}

/** A new request is possible when none is pending. */
export function canAsk(requests: ApiKeyRequest[]): boolean {
  return !requests.some((r) => r.status === "pending");
}

export function purposeProblem(purpose: string): string | null {
  const n = purpose.trim().length;
  if (n < PURPOSE_MIN) return `Tell us a little more (at least ${PURPOSE_MIN} characters).`;
  if (n > PURPOSE_MAX) return `Keep it under ${PURPOSE_MAX} characters.`;
  return null;
}

/** Active keys first, then newest first. */
export function sortKeys(keys: ApiKey[]): ApiKey[] {
  const rank = (k: ApiKey) => (k.state === "active" ? 0 : 1);
  return [...keys].sort((a, b) => rank(a) - rank(b) || b.id - a.id);
}
