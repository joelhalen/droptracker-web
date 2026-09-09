/**
 * The wizard's channel-list retry rule — `lib/group-setup-channels.ts`.
 *
 * Exists because the original behaviour (fetch once, accept an empty cache
 * as final) shipped and looked fine: the pickers still rendered, just as
 * raw-id inputs, and nothing said the list was on its way.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { CHANNELS_POLL_MAX, shouldKeepPollingChannels } from "@/lib/group-setup-channels";

test("an empty list keeps polling until the bound", () => {
  for (let polls = 0; polls < CHANNELS_POLL_MAX; polls++) {
    assert.equal(shouldKeepPollingChannels(0, polls), true, `poll ${polls}`);
  }
  assert.equal(shouldKeepPollingChannels(0, CHANNELS_POLL_MAX), false);
  assert.equal(shouldKeepPollingChannels(0, CHANNELS_POLL_MAX + 3), false);
});

test("a non-empty list is final on the first read", () => {
  assert.equal(shouldKeepPollingChannels(1, 0), false);
  assert.equal(shouldKeepPollingChannels(30, 3), false);
});
