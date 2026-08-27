/**
 * Pure addressing for the shared SSE registry (see lib/use-event-stream.ts).
 *
 * Split out from the hook so it can be unit-tested without React: the identity
 * rule below is a security property — a stream is keyed by WHO is asking, not
 * just what they asked for — and it is exactly the kind of thing a later
 * refactor could quietly weaken.
 */

/** The site's cookie-authenticated proxy. */
export const DEFAULT_STREAM_PATH = "/api/stream";

/** The Discord Activity's proxy, which takes the session as a query param. */
export const ACTIVITY_STREAM_PATH = "/api/activity/stream";

/**
 * Registry key for one shared `EventSource`.
 *
 * Path and token are part of the key, not just the channel list: two viewers
 * of the same channel with different sessions must not share a connection, or
 * whoever connected second would silently inherit the first one's
 * authorization — and on a private event that is the difference between seeing
 * a board and not being allowed to.
 */
export function streamKey(channelKey: string, path: string, token: string): string {
  // Space-joined: a space cannot appear in a path, a JWT, or a channel name,
  // so no two distinct triples can collide on one key.
  return `${path} ${token} ${channelKey}`;
}

/** URL for that connection. The token is omitted entirely when absent, so an
 *  anonymous stream doesn't carry an empty `token=` param. */
export function streamUrl(channelKey: string, path: string, token: string): string {
  const qs = new URLSearchParams({ channels: channelKey });
  if (token) qs.set("token", token);
  return `${path}?${qs}`;
}
