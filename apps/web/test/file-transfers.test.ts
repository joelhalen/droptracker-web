import assert from "node:assert/strict";
import { test } from "node:test";
import type { FileTransfer, FileTransferVersion } from "@droptracker/api-types";
import {
  daysUntilExpiry,
  expiryLabel,
  hasStaffReply,
  latestVersion,
  transferDownloadUrl,
} from "../lib/file-transfers";

const NOW = 1_760_000_000;

function version(n: number, role: "user" | "staff" = "user"): FileTransferVersion {
  return {
    id: 900 + n,
    version: n,
    filename: `file-v${n}.bin`,
    content_type: "application/octet-stream",
    size_bytes: 1024 * n,
    uploaded_by: role === "staff" ? 1 : 1337,
    uploaded_by_name: role === "staff" ? "staff" : "zezima",
    uploaded_by_role: role,
    can_preview: false,
    created_at: NOW - 3600 * n,
  };
}

function transfer(versions: FileTransferVersion[], expiresAt: number | null = null): FileTransfer {
  return {
    id: 41,
    title: "file.bin",
    note: null,
    owner_user_id: 1337,
    owner_name: "zezima",
    latest_version: Math.max(...versions.map((v) => v.version)),
    created_at: NOW - 86_400,
    updated_at: NOW,
    expires_at: expiresAt,
    versions,
  };
}

test("download URLs address a specific version and only opt into preview when asked", () => {
  assert.equal(transferDownloadUrl(41, 2), "/api/file-transfers/41/versions/2/download");
  assert.equal(
    transferDownloadUrl(41, 2, { inline: true }),
    "/api/file-transfers/41/versions/2/download?inline=1",
  );
});

test("latestVersion ignores array order", () => {
  // The API sorts ascending, but nothing in the contract promises it — a
  // reversed list must not make the page lead with the user's original.
  const t = transfer([version(3, "staff"), version(1), version(2, "staff")]);
  assert.equal(latestVersion(t)?.version, 3);
});

test("latestVersion is null when a transfer has no versions", () => {
  assert.equal(latestVersion(transfer([])), null);
});

test("hasStaffReply distinguishes an answered transfer from a fresh one", () => {
  assert.equal(hasStaffReply(transfer([version(1)])), false);
  assert.equal(hasStaffReply(transfer([version(1), version(2, "staff")])), true);
});

test("expiry counts whole days and rounds a partial day up", () => {
  // 29.5 days left still reads as 30 — never round a user's remaining time down.
  assert.equal(daysUntilExpiry(NOW + 29.5 * 86_400, NOW), 30);
  assert.equal(daysUntilExpiry(NOW + 86_400, NOW), 1);
  assert.equal(daysUntilExpiry(null, NOW), null);
});

test("expiry never counts backwards past zero", () => {
  // The API hides expired rows, so a negative countdown would only ever be a
  // clock-skew artefact — clamp rather than render "-2 days left".
  assert.equal(daysUntilExpiry(NOW - 2 * 86_400, NOW), 0);
  assert.equal(expiryLabel(NOW - 2 * 86_400, NOW), "expires today");
});

test("expiry label pluralises", () => {
  assert.equal(expiryLabel(NOW + 86_400, NOW), "1 day left");
  assert.equal(expiryLabel(NOW + 5 * 86_400, NOW), "5 days left");
  assert.equal(expiryLabel(null, NOW), "");
});
