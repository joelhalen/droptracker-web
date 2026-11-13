import assert from "node:assert/strict";
import { test } from "node:test";
import type { ApiKey, ApiKeyRequest } from "@droptracker/api-types";
import {
  canAsk,
  headlineRequest,
  purposeProblem,
  requestStatusText,
  sortKeys,
} from "../lib/api-access";

const req = (over: Partial<ApiKeyRequest>): ApiKeyRequest => ({
  id: 1,
  scope: "group",
  group_id: 7,
  requested_by_user_id: 3,
  label: "bot",
  purpose: "x",
  status: "pending",
  ticket_id: 9,
  api_key_id: null,
  created_at: 1,
  decided_at: null,
  claim_url: null,
  ...over,
});

test("a pending request leads, and blocks asking again", () => {
  const list = [req({ id: 2, status: "denied" }), req({ id: 1 })];
  assert.equal(headlineRequest(list)?.id, 1);
  assert.equal(canAsk(list), false);
});

test("an approved request leads only while its key is uncollected", () => {
  const waiting = req({ status: "approved", claim_url: "https://x/claim/a" });
  assert.equal(headlineRequest([waiting])?.id, 1);
  assert.match(requestStatusText(waiting), /Collect/);
  const collected = req({ status: "approved", claim_url: null });
  assert.equal(headlineRequest([collected]), null);
  assert.equal(canAsk([collected]), true);
});

test("a declined or withdrawn request does not block a new one", () => {
  assert.equal(canAsk([req({ status: "denied" }), req({ status: "cancelled" })]), true);
});

test("the purpose must say something, within bounds", () => {
  assert.ok(purposeProblem("short"));
  assert.ok(purposeProblem("x".repeat(1001)));
  assert.equal(purposeProblem("A Discord bot posting our weekly loot."), null);
});

test("active keys sort above revoked ones, newest first", () => {
  const key = (id: number, state: ApiKey["state"]) => ({ id, state }) as ApiKey;
  const ids = sortKeys([key(1, "active"), key(3, "revoked"), key(2, "active")]).map((k) => k.id);
  assert.deepEqual(ids, [2, 1, 3]);
});
