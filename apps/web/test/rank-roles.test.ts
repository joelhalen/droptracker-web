import assert from "node:assert/strict";
import { test } from "node:test";
import { RankRolesSchema, type RankRoles, type RankRoleStatus } from "@droptracker/api-types";
import {
  CREATE_CHOICE,
  applyRoleChoice,
  buildRows,
  fallbackLabel,
  moveRow,
  roleChoice,
  statusSummary,
  toConfig,
} from "../lib/rank-roles";

const payload: RankRoles = RankRolesSchema.parse({
  group_id: 7,
  guild_linked: true,
  wom_linked: true,
  has_rank_data: true,
  conflict: null,
  config: {
    enabled: true,
    mode: "single",
    create_roles: true,
    exempt_role_id: null,
    ranks: [
      {
        rank: "general",
        role_id: "100000000000000002",
        name: "General",
        create: false,
        created: true,
        delete_when_empty: true,
      },
      {
        rank: "owner",
        role_id: "100000000000000001",
        name: "Owner",
        create: false,
        created: false,
        delete_when_empty: false,
      },
    ],
  },
  ranks: [
    { rank: "general", label: "General", icon_url: null, members: 3, linked_members: 2 },
    { rank: "owner", label: "Owner", icon_url: null, members: 1, linked_members: 1 },
    { rank: "recruit", label: "Recruit", icon_url: null, members: 40, linked_members: 9 },
    { rank: "member", label: "Clan Member", icon_url: null, members: 5, linked_members: 0 },
  ],
  roles: [{ id: "100000000000000001", name: "Owner", position: 5, blocked: null }],
  roles_stale: false,
  roster: { members: 49, linked: 12 },
  preview: { by_rank: { general: 2 }, linked: 12, with_role: 3 },
  status: null,
  limits: { max_ranks: 300, max_role_name: 100, delete_grace_days: 3 },
});

test("rows follow the backend order and merge saved entries", () => {
  const rows = buildRows(payload);
  assert.deepEqual(
    rows.map((r) => r.rank),
    ["general", "owner", "recruit", "member"],
  );
  assert.equal(rows[0]!.created, true);
  assert.equal(rows[2]!.role_id, null);
  assert.equal(rows[2]!.name, "Recruit");
});

test("toConfig keeps order and drops flags that can't apply", () => {
  const rows = buildRows(payload);
  rows[2] = { ...rows[2]!, create: true, delete_when_empty: true };
  rows[1] = { ...rows[1]!, delete_when_empty: true }; // picked role, not created
  const cfg = toConfig(
    { enabled: true, mode: "cumulative", create_roles: true, exempt_role_id: "" },
    rows,
  );
  assert.deepEqual(
    cfg.ranks.map((e) => e.rank),
    ["general", "owner", "recruit", "member"],
  );
  assert.equal(cfg.exempt_role_id, null);
  assert.equal(cfg.ranks[1]!.delete_when_empty, false);
  assert.equal(cfg.ranks[2]!.create, true);
  assert.equal(cfg.ranks[2]!.delete_when_empty, true);
  const off = toConfig(
    { enabled: true, mode: "single", create_roles: false, exempt_role_id: null },
    rows,
  );
  assert.equal(off.ranks[2]!.create, false, "no creating without the switch");
});

test("role choice round-trips and only keeps 'created' for our own role", () => {
  const rows = buildRows(payload);
  const general = rows[0]!;
  assert.equal(roleChoice(general), "100000000000000002");
  const picked = applyRoleChoice(general, "100000000000000001");
  assert.equal(picked.created, false);
  assert.equal(picked.delete_when_empty, false);
  const back = applyRoleChoice(general, "100000000000000002");
  assert.equal(back.created, true);
  const create = applyRoleChoice(rows[2]!, CREATE_CHOICE);
  assert.equal(roleChoice(create), CREATE_CHOICE);
  assert.equal(roleChoice(applyRoleChoice(create, "")), "");
});

test("moving rows and the fallback hint", () => {
  const rows = buildRows(payload);
  assert.deepEqual(
    moveRow(rows, 0, 1).map((r) => r.rank),
    ["owner", "general", "recruit", "member"],
  );
  assert.deepEqual(moveRow(rows, 0, -1), rows);
  assert.equal(fallbackLabel(rows, 0), "Owner");
  assert.equal(fallbackLabel(rows, 2), null);
});

test("status summary wording", () => {
  assert.equal(statusSummary(null).tone, "warn");
  const base: RankRoleStatus = {
    state: "ok",
    at: 1,
    pass: "full",
    linked: 3,
    unlinked: 0,
    checked: 3,
    added: 1,
    removed: 0,
    not_in_server: 1,
    exempt: 0,
    held_back: 0,
    deferred: 0,
    errors: 0,
    created: ["Captain"],
    deleted: [],
    problems: [],
    message: null,
  };
  const ok = statusSummary(base);
  assert.equal(ok.tone, "ok");
  assert.match(ok.text, /Checked 3 members, gave 1 role\./);
  assert.match(ok.text, /1 linked member isn't in your server/);
  assert.match(ok.text, /Created: Captain/);
  assert.equal(statusSummary({ ...base, state: "held_back", message: "held" }).text, "held");
  assert.equal(statusSummary({ ...base, state: "error", message: null }).tone, "error");
});
