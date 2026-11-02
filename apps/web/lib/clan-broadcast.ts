/**
 * Clan broadcast tracking only records players who already have a DropTracker
 * profile in the group. Chat tracking never creates one (the bot's
 * `clan_broadcast._find_subjects`), and the member sync only creates profiles
 * for clanmates who don't run the plugin when "Auto-add WiseOldMan members" is
 * on. So tracking without auto-add misses almost everyone it was turned on for:
 * Divine Valor had 537 WiseOldMan members but 80 profiles, and recorded nothing
 * from chat in its first day (2026-11-02). The editor prompts for auto-add as
 * soon as tracking is switched on.
 */

export type BroadcastRosterPrompt =
  /** Tracking is on and auto-add is off: offer to turn auto-add on. */
  | "needed"
  /** Auto-add was just switched on in this draft and takes effect on save. */
  | "pending";

/** Which prompt the Broadcast tracking block shows, from the unsaved draft and
 * the last saved values. Null when there is nothing to say. */
export function broadcastRosterPrompt(
  draft: { clan_broadcast_tracking?: unknown; auto_provision_members?: unknown },
  saved: { auto_provision_members?: unknown },
): BroadcastRosterPrompt | null {
  if (draft.clan_broadcast_tracking !== true) return null;
  if (draft.auto_provision_members !== true) return "needed";
  return saved.auto_provision_members === true ? null : "pending";
}
