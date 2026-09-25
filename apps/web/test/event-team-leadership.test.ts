/**
 * Team leadership (web48a) on the admin Teams tab. Organisers looked for
 * "Make leader" there, where it didn't exist (Renatus, 2026-09-25), so the
 * roster now appoints leaders in place. These helpers keep its local state
 * in step with the Web API's set_team_role: one holder per role per team.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { EventTeam } from "@droptracker/api-types";
import { teamHasLeadership, withTeamRole } from "@/lib/events";

const member = (player_id: number, role: "leader" | "co_leader" | null = null) => ({
  player_id,
  player_name: `Player ${player_id}`,
  joined_at: null,
  role,
});

const teams = (): EventTeam[] =>
  [
    { id: 1, name: "Red", score: 0, members: [member(10, "leader"), member(11), member(12)] },
    { id: 2, name: "Blue", score: 0, members: [member(20, "leader"), member(21)] },
  ] as EventTeam[];

const roles = (list: EventTeam[], teamId: number) =>
  Object.fromEntries(
    (list.find((t) => t.id === teamId)?.members ?? []).map((m) => [m.player_id, m.role ?? null]),
  );

test("a new leader demotes the old one, on that team only", () => {
  const before = teams();
  const after = withTeamRole(before, 1, 11, "leader");
  assert.deepEqual(roles(after, 1), { 10: null, 11: "leader", 12: null });
  assert.equal(after[1], before[1], "the other team is untouched");
});

test("a co-leader sits beside the leader", () => {
  const after = withTeamRole(teams(), 1, 12, "co_leader");
  assert.deepEqual(roles(after, 1), { 10: "leader", 11: null, 12: "co_leader" });
});

test("promoting the co-leader leaves them with the one role", () => {
  const withCo = withTeamRole(teams(), 1, 12, "co_leader");
  const after = withTeamRole(withCo, 1, 12, "leader");
  assert.deepEqual(roles(after, 1), { 10: null, 11: null, 12: "leader" });
});

test("clearing a role touches nobody else", () => {
  const withCo = withTeamRole(teams(), 1, 12, "co_leader");
  const after = withTeamRole(withCo, 1, 10, null);
  assert.deepEqual(roles(after, 1), { 10: null, 11: null, 12: "co_leader" });
});

test("a team is only stuck when nobody holds a role", () => {
  assert.equal(teamHasLeadership([]), false);
  assert.equal(teamHasLeadership([{ role: null }, {}]), false);
  assert.equal(teamHasLeadership([{ role: null }, { role: "co_leader" }]), true);
  assert.equal(teamHasLeadership([{ role: "leader" }]), true);
});
