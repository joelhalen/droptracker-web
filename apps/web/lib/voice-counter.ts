/**
 * The two `vc_to_display_*` voice counters, as the bot sees them.
 *
 * Mirrors `resolve_channel_id` in the bot's `services/channel_name_render.py`
 * so the config editor can tell, before an admin saves, whether the bot will
 * actually be able to run both counters. Keep the two in step.
 */

/** The snowflake in a `vc_to_display_*` value, or null if there isn't one.
 *
 * Same three kinds of junk the bot has to reject: unset (`""`/null), the legacy
 * `"0"` sentinel (truthy as a string, so it reads as configured when it isn't),
 * and free text — the channel picker degrades to a plain box when the guild's
 * voice channels aren't cached and people type the channel's *name*.
 *
 * Returned as a normalized string rather than a number: snowflakes exceed
 * `Number.MAX_SAFE_INTEGER`, so comparing them as numbers can make two
 * different channels look identical. */
export function resolveChannelId(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) return null;
  // Leading zeros are stripped so "0000123" and "123" compare equal, matching
  // the bot's int() — and "0"/"000" fall out as unset, not as channel zero.
  const normalized = raw.replace(/^0+/, "");
  return normalized === "" ? null : normalized;
}

/** The channel id both voice counters point at, or null when they don't collide.
 *
 * One channel can only carry one name. The bot's member-count loop runs after
 * the loot loop, so on a collision it overwrites the loot name every cycle and
 * the group sees nothing but the member count — no error, and nothing in the
 * guild audit log after the first write. 22 groups were in this state on
 * 2026-09-01, which is why the editor warns instead of letting it happen again.
 *
 * Junk on both sides is not a collision: two unset (or two `"0"`) fields both
 * resolve to null, and null must never match null here. */
export function collidingVoiceCounterChannel(loot: unknown, members: unknown): string | null {
  const lootId = resolveChannelId(loot);
  const memberId = resolveChannelId(members);
  return lootId !== null && lootId === memberId ? lootId : null;
}
