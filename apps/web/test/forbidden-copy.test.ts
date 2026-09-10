import assert from "node:assert/strict";
import { test } from "node:test";
import { MeSchema, type Me } from "@droptracker/api-types";
import { forbiddenCopy } from "../lib/forbidden-copy";

/** A signed-in, non-staff user; `groups` is the only thing under test. */
function me(groups: Me["groups"]): Me {
  return MeSchema.parse({
    user_id: 42,
    discord_id: "1",
    is_superadmin: false,
    is_developer: false,
    players: [],
    groups,
  });
}

test("the staff area keeps its own copy", () => {
  assert.equal(forbiddenCopy("/admin/groups").title, "Staff only");
});

test("a group admin page, before /me loads, links to the public profile", () => {
  for (const viewer of [undefined, null]) {
    const copy = forbiddenCopy("/groups/14/settings", viewer);
    assert.equal(copy.title, "Group admins only");
    assert.deepEqual(copy.back, { href: "/groups/14", label: "View the group's public page" });
    assert.match(copy.message, /Authorized users/);
  }
});

test("an event manager is sent to the group's events, not told to become an admin", () => {
  const manager = me([{ id: 14, name: "Clan", role: "member", can_manage_events: true }]);
  const copy = forbiddenCopy("/groups/14/admin", manager);
  assert.equal(copy.title, "Group admins only");
  assert.deepEqual(copy.back, { href: "/groups/14/events", label: "Go to the group's events" });
  assert.match(copy.message, /event manager/);
  assert.doesNotMatch(copy.message, /Authorized users/);
});

test("the manager copy is per group", () => {
  const manager = me([{ id: 7, name: "Other", role: "member", can_manage_events: true }]);
  assert.deepEqual(forbiddenCopy("/groups/14/admin", manager).back?.href, "/groups/14");
});

test("a plain member gets the standard copy", () => {
  const member = me([{ id: 14, name: "Clan", role: "member", can_manage_events: false }]);
  assert.equal(forbiddenCopy("/groups/14/admin", member).back?.href, "/groups/14");
});

test("anything else is a generic denial", () => {
  const copy = forbiddenCopy("/tickets/9");
  assert.equal(copy.title, "Access denied");
  assert.equal(copy.back, undefined);
});
