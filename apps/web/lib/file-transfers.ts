/**
 * Pure helpers for the file-transfer surfaces (web95a), shared by the user
 * page at /file-transfer and the staff tab at /admin/file-transfers.
 *
 * Kept out of the components so the URL shape and the retention arithmetic —
 * the two things both surfaces must agree on — are unit-testable.
 */
import type { FileTransfer, FileTransferVersion } from "@droptracker/api-types";

/**
 * BFF download URL for one version.
 *
 * `inline` only *asks* for a preview: the backend grants it for a short list of
 * inert types and forces a download for everything else, so a caller passing
 * `inline` for an SVG still gets an attachment. `version.can_preview` mirrors
 * that list, which is what decides whether a View link is worth rendering.
 */
export function transferDownloadUrl(
  transferId: number,
  version: number,
  opts: { inline?: boolean } = {},
): string {
  const base = `/api/file-transfers/${transferId}/versions/${version}/download`;
  return opts.inline ? `${base}?inline=1` : base;
}

/** Newest version first — the one both surfaces lead with. */
export function latestVersion(transfer: FileTransfer): FileTransferVersion | null {
  if (transfer.versions.length === 0) return null;
  return transfer.versions.reduce((a, b) => (b.version > a.version ? b : a));
}

/** Whether staff have answered this transfer with an updated copy yet. */
export function hasStaffReply(transfer: FileTransfer): boolean {
  return transfer.versions.some((v) => v.uploaded_by_role === "staff");
}

/**
 * Whole days left before the retention sweep takes this transfer.
 *
 * Rounds up, so the last partial day still reads "1 day left" rather than "0" —
 * and never goes negative, because an expired row is hidden by the API rather
 * than shown counting backwards.
 */
export function daysUntilExpiry(expiresAt: number | null, nowSeconds: number): number | null {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((expiresAt - nowSeconds) / 86_400));
}

/** "29 days left" / "expires today" — the retention hint next to each row. */
export function expiryLabel(expiresAt: number | null, nowSeconds: number): string {
  const days = daysUntilExpiry(expiresAt, nowSeconds);
  if (days === null) return "";
  if (days === 0) return "expires today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}
