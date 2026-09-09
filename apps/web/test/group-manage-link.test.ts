import assert from "node:assert/strict";
import { test } from "node:test";
import { MeSchema, type Me } from "@droptracker/api-types";
import { groupManageLink } from "../lib/auth";

/** A signed-in, non-staff user; `groups` is the only thing under test. */
function me(groups: Me["groups"], overrides: Partial<Me> = {}): Me {
  return MeSchema.parse({
    user_id: 42,
    discord_id: "1",
    is_superadmin: false,
    is_developer: false,
    players: [],
    groups,
    ...overrides,
  });
}

test("signed-out viewers get no manage link", () => {
  assert.equal(groupManageLink(null, 101), null);
});

test("owners and admins are sent to the admin overview", () => {
  const owner = me([{ id: 101, name: "Clan", role: "owner", can_manage_events: true }]);
  assert.deepEqual(groupManageLink(owner, 101), {
    href: "/groups/101/admin",
    label: "Manage group",
  });
  const admin = me([{ id: 101, name: "Clan", role: "admin", can_manage_events: true }]);
  assert.deepEqual(groupManageLink(admin, 101), {
    href: "/groups/101/admin",
    label: "Manage group",
  });
});

test("a pure event manager is sent to Events, not /admin (which would 403)", () => {
  const manager = me([{ id: 101, name: "Clan", role: "member", can_manage_events: true }]);
  assert.deepEqual(groupManageLink(manager, 101), {
    href: "/groups/101/events",
    label: "Manage events",
  });
});

test("plain members and non-members get nothing", () => {
  const member = me([{ id: 101, name: "Clan", role: "member", can_manage_events: false }]);
  assert.equal(groupManageLink(member, 101), null);
  // Admin of a different group — the id must match, not just the role.
  assert.equal(
    groupManageLink(me([{ id: 7, name: "Other", role: "owner", can_manage_events: true }]), 101),
    null,
  );
});

test("superadmins manage every group, even ones they are not in", () => {
  const staff = me([], { is_superadmin: true });
  assert.deepEqual(groupManageLink(staff, 101), {
    href: "/groups/101/admin",
    label: "Manage group",
  });
});
