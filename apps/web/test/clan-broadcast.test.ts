import assert from "node:assert/strict";
import { test } from "node:test";
import { broadcastRosterPrompt } from "../lib/clan-broadcast";

test("no prompt while broadcast tracking is off", () => {
  assert.equal(broadcastRosterPrompt({ clan_broadcast_tracking: false, auto_provision_members: false }, {}), null);
  assert.equal(broadcastRosterPrompt({}, {}), null);
});

// The case that produced the ticket: tracking on, auto-add off.
test("tracking without auto-add asks for auto-add", () => {
  assert.equal(
    broadcastRosterPrompt(
      { clan_broadcast_tracking: true, auto_provision_members: false },
      { auto_provision_members: false },
    ),
    "needed",
  );
  assert.equal(broadcastRosterPrompt({ clan_broadcast_tracking: true }, {}), "needed");
});

test("auto-add switched on in the draft is pending until saved", () => {
  assert.equal(
    broadcastRosterPrompt(
      { clan_broadcast_tracking: true, auto_provision_members: true },
      { auto_provision_members: false },
    ),
    "pending",
  );
});

test("nothing to say once both are saved on", () => {
  assert.equal(
    broadcastRosterPrompt(
      { clan_broadcast_tracking: true, auto_provision_members: true },
      { auto_provision_members: true },
    ),
    null,
  );
});
