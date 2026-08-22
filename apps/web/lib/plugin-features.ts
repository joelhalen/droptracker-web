/**
 * Plugin features the website renders before the plugin can feed them.
 *
 * Account progress sync — the collection log, combat achievements, diaries,
 * quests and the character model — is built and live here, but nothing can
 * populate it yet: it is written by the plugin's state sync, which ships in
 * v6 and is not published on the Plugin Hub. Until it is, every empty state
 * that says "enable this in the plugin" names a setting that does not exist
 * in the build people are running, so it reads as a bug in their client
 * rather than a release that has not landed.
 *
 * Nothing here hides data. The handful of accounts already synced from dev
 * builds still render normally; this only changes what the *empty* case says
 * and marks the tabs and links that lead to it.
 *
 * When v6 is published, flip STATE_SYNC_RELEASED to true — that is the whole
 * change. Check the Plugin Hub's pinned commit rather than the plugin repo's
 * master, which runs ahead of what the hub actually builds and serves:
 *
 *   curl -s https://raw.githubusercontent.com/runelite/plugin-hub/master/plugins/droptracker
 */

/** Is the plugin release that feeds account progress sync actually out? */
export const STATE_SYNC_RELEASED = false;

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
