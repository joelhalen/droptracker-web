import assert from "node:assert/strict";
import { test } from "node:test";
import { collidingVoiceCounterChannel, resolveChannelId } from "../lib/voice-counter";

// Parity with resolve_channel_id in disc/services/channel_name_render.py: the
// editor must judge a value configured exactly when the bot would act on it.
test("only a real snowflake counts as a configured channel", () => {
  assert.equal(resolveChannelId("1542566004398489630"), "1542566004398489630");
  assert.equal(resolveChannelId(null), null);
  assert.equal(resolveChannelId(""), null);
  assert.equal(resolveChannelId("   "), null);
  assert.equal(resolveChannelId("Cage"), null); // picker degraded to a text box
  assert.equal(resolveChannelId("#general"), null);
  assert.equal(resolveChannelId("123abc"), null);
});

// "0" is the legacy unset sentinel and truthy as a string — treating it as a
// channel would flag two unconfigured counters as colliding.
test("the legacy zero sentinel is not a channel", () => {
  assert.equal(resolveChannelId("0"), null);
  assert.equal(resolveChannelId(0), null);
  assert.equal(resolveChannelId("000"), null);
});

// Snowflakes are past Number.MAX_SAFE_INTEGER, so ids stay strings; leading
// zeros are stripped to match the bot's int() before the two are compared.
test("ids are normalized without losing precision", () => {
  assert.equal(resolveChannelId(" 1542566004398489630 "), "1542566004398489630");
  assert.equal(resolveChannelId("0000123"), "123");
  assert.equal(resolveChannelId("1542566004398489631"), "1542566004398489631");
});

// The 22 groups found on 2026-09-01: one channel, both counters, member count
// wins because its loop runs second and the loot total never shows.
test("one channel in both counters is a collision", () => {
  assert.equal(
    collidingVoiceCounterChannel("1542566004398489630", "1542566004398489630"),
    "1542566004398489630",
  );
  assert.equal(collidingVoiceCounterChannel("0000123", "123"), "123");
});

test("two different channels are fine", () => {
  assert.equal(
    collidingVoiceCounterChannel("1542566004398489630", "1542566004398489631"),
    null,
  );
});

// Both unset is the common case (and both "0" is the common legacy case) —
// neither may render a warning saying they share a channel.
test("unset or junk on both sides is not a collision", () => {
  assert.equal(collidingVoiceCounterChannel(null, null), null);
  assert.equal(collidingVoiceCounterChannel("", ""), null);
  assert.equal(collidingVoiceCounterChannel("0", "0"), null);
  assert.equal(collidingVoiceCounterChannel("Cage", "Cage"), null);
  assert.equal(collidingVoiceCounterChannel("1542566004398489630", null), null);
  assert.equal(collidingVoiceCounterChannel(null, "1542566004398489630"), null);
});
