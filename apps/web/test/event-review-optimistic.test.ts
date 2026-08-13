/**
 * The Review queue's optimistic bookkeeping. Confirm/reject/revoke now update
 * the list before the server answers — so the two rules that keep that honest
 * are: a row leaves the list exactly when its new status stops matching the
 * active filter, and a failed action puts the row back where it was rather
 * than silently swallowing it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { completionMatchesFilter, restoreOptimisticRow } from "@/lib/events";

const row = (id: number) => ({ id });

test("a decided row leaves the pending queue", () => {
  // What the reviewer sees the moment they click: the row is gone.
  for (const decided of ["confirmed", "rejected", "revoked"]) {
    assert.equal(completionMatchesFilter(decided, "pending"), false, decided);
  }
  assert.equal(completionMatchesFilter("pending", "pending"), true);
});

test("the 'all' filter keeps every row through its status change", () => {
  // Under 'all' the row stays put and just re-renders with its new status
  // (Confirm/Reject swap to Revoke), so it must never be filtered out.
  for (const status of ["pending", "auto", "confirmed", "manual", "rejected", "revoked"]) {
    assert.equal(completionMatchesFilter(status, "all"), true, status);
  }
});

test("a ledger filter keeps only its own status", () => {
  assert.equal(completionMatchesFilter("confirmed", "confirmed"), true);
  assert.equal(completionMatchesFilter("auto", "confirmed"), false);
});

test("a failed action puts the row back at its old position", () => {
  const rows = [row(1), row(3), row(4)];
  assert.deepEqual(
    restoreOptimisticRow(rows, row(2), 1).map((r) => r.id),
    [1, 2, 3, 4],
  );
});

test("restoring never duplicates a row that is still listed", () => {
  // Under the 'all' filter the optimistic update patches the row in place
  // instead of removing it, so the rollback has to replace, not insert.
  const rows = [row(1), row(2), row(3)];
  assert.deepEqual(
    restoreOptimisticRow(rows, row(2), 1).map((r) => r.id),
    [1, 2, 3],
  );
});

test("restoring survives the list changing underneath it", () => {
  // A refresh (or a bulk confirm) can land between the click and the failure;
  // the row is appended rather than dropped when its old index is gone.
  assert.deepEqual(
    restoreOptimisticRow([row(9)], row(2), 7).map((r) => r.id),
    [9, 2],
  );
  assert.deepEqual(
    restoreOptimisticRow([], row(2), -1).map((r) => r.id),
    [2],
  );
});
