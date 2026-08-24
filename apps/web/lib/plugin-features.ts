/**
 * Plugin features the website renders before the plugin can feed them.
 *
 * Account progress sync — the collection log, combat achievements, diaries,
 * quests and the character model — is written by the plugin's state sync,
 * which ships in v6. v6.0 was published on the Plugin Hub on 2026-08-24, so
 * the switch below is on and every panel shows its own real instruction.
 *
 * Keep the mechanism: while a feature is built here but unreachable in the
 * published build, an empty state that says "enable this in the plugin" names
 * a setting that does not exist for the reader, so it reads as a bug in their
 * client rather than a release that has not landed. Flip the flag back off
 * (or add another) if that situation recurs.
 *
 * Nothing here hides data — it only changes what the *empty* case says and
 * marks the tabs and links that lead to it.
 *
 * Judge a release by what the Plugin Hub actually serves, not by the plugin
 * repo's master, which runs ahead of it — and not by the hub's pinned commit
 * either, which ran three days ahead of the published 6.0 build:
 *
 *   curl -s https://raw.githubusercontent.com/runelite/plugin-hub/master/plugins/droptracker
 */

/** Is the plugin release that feeds account progress sync actually out? */
export const STATE_SYNC_RELEASED = true;

/** The plugin release that turns account progress sync on. */
export const STATE_SYNC_PLUGIN_VERSION = "v6";

/** Pill text for a tab or link whose panel cannot have data yet. */
export const SOON_BADGE = "Soon";

/** Tooltip behind that pill — the pill alone does not say *why*. */
export const SOON_TITLE = `Ships with DropTracker plugin ${STATE_SYNC_PLUGIN_VERSION}, which is not released yet`;

/**
 * Empty-state copy for one account progress panel.
 *
 * Before the release the copy is uniform and points at the update; after it,
 * each caller's own instruction takes over, because "how do I fill this in?"
 * differs per panel (the collection log also needs opening in game).
 *
 * @param label   The panel, sentence-cased: "Collection log sync".
 * @param hint    What to tell people once the release is out.
 */
export function stateSyncEmpty(label: string, hint: string): { title: string; hint: string } {
  if (STATE_SYNC_RELEASED) return { title: `No ${label.toLowerCase()} recorded`, hint };
  return {
    title: `${label} coming soon`,
    hint: `Account progress sync ships with DropTracker plugin ${STATE_SYNC_PLUGIN_VERSION}, which is not released yet. There is nothing to switch on in the meantime — this fills in on its own once the update is out.`,
  };
}
