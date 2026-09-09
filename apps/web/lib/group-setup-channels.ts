/**
 * When the group-setup wizard should keep re-asking for a server's channel
 * list.
 *
 * The list comes from the bot's Redis cache, which is warmed by a 5-minute
 * sweep and on demand (every read queues a refresh the bot drains within
 * ~15s; the bot also queues one the moment it joins a server). A wizard that
 * fetched once, right after the invite, found the cache empty and silently
 * dropped both pickers to raw channel-id entry — which is exactly what the
 * "Loading…" line had promised it would not do. So an empty answer is
 * treated as "not yet", up to a bound, rather than as the final word.
 */

/** How long to wait between re-reads. Longer than the bot's drain interval
 * would waste a beat; much shorter would just hammer the cache. */
export const CHANNELS_POLL_INTERVAL_MS = 5_000;

/** Re-reads before giving up: ~40s covers a bot drain (≤15s) with room for a
 * slow Discord fetch, without holding a real "no channels" server hostage. */
export const CHANNELS_POLL_MAX = 8;

/**
 * True while another read is worth scheduling: the last answer was empty and
 * the bound has not been reached. A non-empty list is final — the bot does
 * not cache partial guilds — and so is the bound.
 */
export function shouldKeepPollingChannels(channelCount: number, pollsSoFar: number): boolean {
  return channelCount === 0 && pollsSoFar < CHANNELS_POLL_MAX;
}
