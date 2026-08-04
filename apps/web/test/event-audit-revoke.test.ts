/**
 * Which audit-log rows offer a Revoke button. The audit timeline is where an
 * admin actually spots a mistaken confirmation (it carries the proof
 * screenshot and the before/after), so the gate has to agree exactly with the
 * backend's `APPLIED_STATUSES` — offering Revoke on a row the API will 409 on
 * is worse than not offering it at all.
 *
 * Both audit sources report the completion's *current* status, so a
 * confirmation that was already revoked must not offer a second revoke.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { APPLIED_COMPLETION_STATUSES, isRevocableCompletion } from "@/lib/events";

const entry = (completion_id: number | null, status: string | null) => ({
  completion_id,
  status,
});

test("every applied status is revocable", () => {
  for (const status of APPLIED_COMPLETION_STATUSES) {
    assert.equal(isRevocableCompletion(entry(1, status)), true, status);
  }
});

test("a decided-but-not-counting row offers no revoke", () => {
  // 'pending' is Review's job (confirm/reject); 'rejected' never counted and
  // 'revoked' already stopped — the API rejects all three.
  for (const status of ["pending", "rejected", "revoked"]) {
    assert.equal(isRevocableCompletion(entry(1, status)), false, status);
  }
});

test("rows that aren't completions at all offer no revoke", () => {
  // Task edits, settings changes, roster moves: no ledger row behind them.
  assert.equal(isRevocableCompletion(entry(null, null)), false);
  // Defensive: a completion id with no status, or a status with no id, is not
  // enough to act on.
  assert.equal(isRevocableCompletion(entry(1, null)), false);
  assert.equal(isRevocableCompletion(entry(null, "confirmed")), false);
});

test("an unknown status is not assumed revocable", () => {
  // A status added backend-side must fail closed here until it's classified.
  assert.equal(isRevocableCompletion(entry(1, "escalated")), false);
});
