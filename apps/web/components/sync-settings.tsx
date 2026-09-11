/**
 * The plugin settings an account-progress panel needs, shown under its empty
 * state.
 *
 * "Use API" comes first and is highlighted because it is the one people are
 * missing (see `PLUGIN_SETTINGS`). Each panel's own setting is on by default,
 * so copy that named only that setting told players with the API off to switch
 * on something they already had, and never mentioned the one they needed.
 *
 * No "use client": it has no state, so server pages and the client profile
 * showcase can both render it.
 */
import { PLUGIN_SETTINGS, STATE_SYNC_RELEASED } from "@/lib/plugin-features";

export function SyncSettings({ setting }: { setting: string }) {
  // Before a release these settings are not in the reader's build, and
  // stateSyncEmpty already says there is nothing to switch on.
  if (!STATE_SYNC_RELEASED) return null;

  return (
    <div className="flex flex-col items-center gap-1.5 text-xs">
      <ul className="flex flex-col gap-1 text-left">
        <li className="border-osrs-gold/40 bg-osrs-gold/10 rounded border px-2 py-1">
          <span className="text-osrs-gold-bright font-semibold">{PLUGIN_SETTINGS.useApi}</span>
          <span className="text-osrs-parchment-dark/80"> (off by default: turn this on)</span>
        </li>
        <li className="px-2 py-0.5">
          <span className="text-osrs-parchment/90 font-semibold">{setting}</span>
          <span className="text-osrs-parchment-dark/60"> (on by default)</span>
        </li>
      </ul>
      <span className="text-osrs-parchment-dark/50">
        Both are in the plugin’s Advanced section, which starts collapsed.
      </span>
    </div>
  );
}
