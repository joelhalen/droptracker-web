import type { DataRemovalRequest } from "@droptracker/api-types";

/**
 * Pure helpers for the data-removal panels (components/data-removal.tsx),
 * kept here so they are unit-tested without React or Server Actions.
 */

/** OSRS treats space, '_' and '-' as the same character; so does the backend. */
export function namesMatch(typed: string, actual: string): boolean {
  const norm = (s: string) => s.trim().replace(/[ _-]+/g, " ").toLowerCase();
  return actual.length > 0 && norm(typed) === norm(actual);
}

const DATE = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatUtc(unixSeconds: number | null): string {
  return unixSeconds ? `${DATE.format(new Date(unixSeconds * 1000))} UTC` : "";
}

/** One line describing where a request stands. Pure, so it is unit-tested. */
export function removalStatusText(req: DataRemovalRequest): string {
  switch (req.status) {
    case "awaiting_verification":
      return "Waiting for you to verify with our staff in your support ticket.";
    case "scheduled":
      return `Approved. Your data will be removed on ${formatUtc(req.purge_after)}. You can still cancel until then.`;
    case "completed":
      return "Removed.";
    case "cancelled":
      return "Cancelled. Nothing was removed.";
    case "rejected":
      return "Not approved. Nothing was removed. See your support ticket for why.";
    case "failed":
      return "Something went wrong while removing this. Our staff have been told.";
  }
}
