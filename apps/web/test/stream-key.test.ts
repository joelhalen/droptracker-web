import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACTIVITY_STREAM_PATH,
  DEFAULT_STREAM_PATH,
  streamKey,
  streamUrl,
} from "../lib/stream-key";

// The SSE registry shares one EventSource per key across every subscriber on
// the page. What goes into that key therefore decides who can end up reading
// whose stream — these tests pin that, not formatting.

const CHANNEL = "event:4211";
const TOKEN_A = "eyJhbGciOiJIUzI1NiJ9.aaa.sig";
const TOKEN_B = "eyJhbGciOiJIUzI1NiJ9.bbb.sig";

test("two sessions on the same channel never share a connection", () => {
  // The whole point: if the key were the channel alone, whoever subscribed
  // second would inherit the first viewer's authorization — on a private
  // event, the difference between seeing the board and being refused it.
  assert.notEqual(
    streamKey(CHANNEL, ACTIVITY_STREAM_PATH, TOKEN_A),
    streamKey(CHANNEL, ACTIVITY_STREAM_PATH, TOKEN_B),
  );
});

test("an anonymous viewer never shares a connection with a signed-in one", () => {
  assert.notEqual(
    streamKey(CHANNEL, ACTIVITY_STREAM_PATH, ""),
    streamKey(CHANNEL, ACTIVITY_STREAM_PATH, TOKEN_A),
  );
});

test("site and Activity streams stay separate even for the same channel", () => {
  assert.notEqual(
    streamKey(CHANNEL, DEFAULT_STREAM_PATH, ""),
    streamKey(CHANNEL, ACTIVITY_STREAM_PATH, ""),
  );
});

test("identical subscribers DO share, or the dedupe that motivates the registry is lost", () => {
  assert.equal(
    streamKey(CHANNEL, ACTIVITY_STREAM_PATH, TOKEN_A),
    streamKey(CHANNEL, ACTIVITY_STREAM_PATH, TOKEN_A),
  );
});

test("no two distinct triples collide on one key", () => {
  // A separator that could appear inside a component would let e.g.
  // (path=/a, token=b) and (path=/a b, token=) collide.
  const keys = new Set([
    streamKey("feed", "/api/stream", ""),
    streamKey("", "/api/stream", "feed"),
    streamKey("feed", "/api/stream", "x"),
    streamKey("feed x", "/api/stream", ""),
  ]);
  assert.equal(keys.size, 4);
});

test("an anonymous URL carries no empty token param", () => {
  const url = streamUrl("feed", DEFAULT_STREAM_PATH, "");
  assert.equal(url, "/api/stream?channels=feed");
  assert.ok(!url.includes("token"));
});

test("a token is passed as a query param, url-encoded", () => {
  const url = new URL(streamUrl(CHANNEL, ACTIVITY_STREAM_PATH, TOKEN_A), "https://x.test");
  assert.equal(url.pathname, ACTIVITY_STREAM_PATH);
  assert.equal(url.searchParams.get("channels"), CHANNEL);
  // Read back through the parser: the JWT must survive intact, dots and all.
  assert.equal(url.searchParams.get("token"), TOKEN_A);
});

test("channel names with reserved characters survive the round trip", () => {
  // "event:4211" contains a colon; a comma separates multiple channels.
  const url = new URL(
    streamUrl("event:4211,chat:9", ACTIVITY_STREAM_PATH, ""),
    "https://x.test",
  );
  assert.equal(url.searchParams.get("channels"), "event:4211,chat:9");
});
