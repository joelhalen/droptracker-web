import type { PluginConfig, PluginSettingValue } from "@/lib/api/plugin-config";
import { Alert, Badge, Card, EmptyState } from "@/components/ui";

/** The plugin's own names for its settings (DropTrackerConfig). Unknown keys,
 *  from a newer plugin, fall back to the raw key. */
const LABELS: Record<string, string> = {
  lootEmbeds: "Drops",
  pbEmbeds: "Personal bests",
  clogEmbeds: "Collection logs",
  caEmbeds: "Combat achievements",
  petEmbeds: "Pets",
  levelEmbed: "Levels",
  xpMilestoneEmbeds: "XP milestones",
  questsEmbed: "Quests",
  deathEmbeds: "Deaths",
  diaryEmbeds: "Achievement diaries",
  slayerEmbeds: "Slayer tasks",
  trackActivities: "Activity tracking",
  clanChatSync: "Clan chat sync",
  // Pre-6.0.18 keys, still shown for older snapshots.
  relayClanBroadcasts: "Clan broadcasts (old setting)",
  relayClanChat: "Relay clan chat to Discord (old setting)",
  screenshots: "Enable screenshots",
  screenshotValue: "Loot screenshot value",
  screenshotUntradeables: "Screenshot untradeables",
  minLevelToScreenshot: "Minimum level to screenshot",
  privacyMode: "Privacy mode",
  hideWhispers: "Hide PMs (old setting)",
  compressImages: "Compress screenshots",
  screenshotCompressionKb: "Compression threshold (KB)",
  imageCompressionThresholdKb: "Compression threshold (KB, old setting)",
  eventNotifications: "Receive notifications",
  eventDisplayMode: "Display type",
  eventTaskProgressNotifications: "Task progress notifications",
  eventHudDetail: "HUD details",
  eventTeamIndicators: "Team indicators in chat",
  eventTeamIndicatorColorNames: "Color teammates' names",
  eventTeamIndicatorsPublicChat: "Also badge public chat",
  useApi: "Use API",
  receiveInGameMessages: "Receive in-game messages",
  dropConfirmations: "Drop confirmations",
  receiveDiscordChat: "Show Discord messages in game",
  syncAccountState: "Sync account progress",
  uploadCharacterModel: "Send character model & gear",
  showSidePanel: "Show side panel",
  debugLogging: "Debug logging",
  trackExperience: "Track experience",
  trackTrawling: "Deep sea trawling",
  sendLoadoutWithPbs: "Send gear with personal bests",
  eventImportantPopupsOnly: "Pop-ups: important only",
  pollUpdates: "Polling updates",
};

const ENV_LABELS: Record<string, string> = {
  runelite_version: "RuneLite version",
  resizable: "Resizable mode",
  chatbox_transparent: "Transparent chatbox",
  loot_tracker_enabled: "RuneLite Loot Tracker plugin on",
  custom_api_endpoint: "Custom API endpoint set",
};

const SECTION_NOTES: Record<string, string> = {
  Hidden: "Not shown in the plugin panel. Older settings the plugin still reads.",
};

function label(key: string, labels = LABELS): string {
  return labels[key] ?? key;
}

/** "ENHANCED" -> "Enhanced", 250000 -> "250,000", true -> "On". */
function show(value: PluginSettingValue | undefined): string {
  if (value === undefined || value === null) return "Not set";
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "number") return value.toLocaleString("en-US");
  if (/^[A-Z0-9_]+$/.test(value)) {
    const words = value.toLowerCase().replace(/_/g, " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return value;
}

function when(iso: string | null): string {
  if (!iso) return "unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function ValueCell({ value }: { value: PluginSettingValue | undefined }) {
  const tone =
    value === true ? "text-osrs-green" : value === false ? "text-osrs-red" : "text-osrs-gold-bright";
  return <span className={`tabular-nums ${tone}`}>{show(value)}</span>;
}

export function PluginConfigView({ data }: { data: PluginConfig }) {
  const snap = data.snapshot;
  if (!snap) {
    return (
      <EmptyState
        title="No settings reported yet"
        hint="The plugin sends its settings after login from version 6.0.16. Ask the player to update the plugin and log in."
      />
    );
  }
  const customized = new Set(snap.customized);

  return (
    <div className="space-y-5">
      <Alert variant="info">
        Reported by the player&apos;s plugin on {when(snap.captured_at)}. Settings marked{" "}
        <Badge variant="bronze">changed</Badge> differ from the plugin&apos;s defaults.
      </Alert>

      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Card padding="p-3">
          <div className="text-osrs-parchment-dark/60 text-xs">Plugin version</div>
          <div className="text-osrs-gold-bright">{snap.plugin_version ?? "unknown"}</div>
        </Card>
        <Card padding="p-3">
          <div className="text-osrs-parchment-dark/60 text-xs">Sent through</div>
          <div className="text-osrs-gold-bright">
            {snap.transport === "api" ? "API" : snap.transport === "webhook" ? "Discord webhook" : "unknown"}
          </div>
        </Card>
        <Card padding="p-3">
          <div className="text-osrs-parchment-dark/60 text-xs">Changed from defaults</div>
          <div className="text-osrs-gold-bright">{snap.customized.length} settings</div>
        </Card>
        <Card padding="p-3">
          <div className="text-osrs-parchment-dark/60 text-xs">Previous report</div>
          <div className="text-osrs-gold-bright">
            {snap.previous_captured_at ? when(snap.previous_captured_at) : "None"}
          </div>
        </Card>
      </div>

      {snap.changed_since_previous.length > 0 && (
        <Card header={<h2 className="text-osrs-gold font-semibold">Changed since the previous report</h2>}>
          <ul className="space-y-1 text-sm">
            {snap.changed_since_previous.map((c) => (
              <li key={c.key} className="flex flex-wrap items-center justify-between gap-2">
                <span>{label(c.key)}</span>
                <span>
                  <ValueCell value={c.from} /> <span className="text-osrs-parchment-dark/50">to</span>{" "}
                  <ValueCell value={c.to} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(snap.settings).map(([section, values]) => (
          <Card
            key={section}
            header={
              <div>
                <h2 className="text-osrs-gold font-semibold">{section}</h2>
                {SECTION_NOTES[section] && (
                  <p className="text-osrs-parchment-dark/60 text-xs">{SECTION_NOTES[section]}</p>
                )}
              </div>
            }
          >
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(values).map(([key, value]) => (
                  <tr key={key} className="border-osrs-bronze/10 border-t first:border-t-0">
                    <td className="py-1.5 pr-3">
                      <span title={key}>{label(key)}</span>
                      {customized.has(key) && (
                        <Badge variant="bronze" className="ml-2">
                          changed
                        </Badge>
                      )}
                    </td>
                    <td className="py-1.5 text-right">
                      <ValueCell value={value} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}

        <Card header={<h2 className="text-osrs-gold font-semibold">Client</h2>}>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(snap.env).map(([key, value]) => (
                <tr key={key} className="border-osrs-bronze/10 border-t first:border-t-0">
                  <td className="py-1.5 pr-3">{label(key, ENV_LABELS)}</td>
                  <td className="py-1.5 text-right">
                    <ValueCell value={value} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
