/** Unsaved-changes detection for the per-event Discord settings form.
 *
 * That form (components/event-discord.tsx) saves through one explicit button
 * and is mounted in three places — its own page, the event manager's Discord
 * tab, and the setup wizard's Discord step — so it needs to know, at any
 * moment, whether the draft differs from the last copy the backend confirmed.
 *
 * The comparison is per section, which drives both the "unsaved" chip on each
 * collapsed section header and the overall save-bar state. Serialization is
 * deliberately order-insensitive: clearing and re-typing a channel id, or
 * toggling a ping role off and back on, reorders the underlying object keys /
 * array without changing the configuration, and must not read as an edit.
 */
import type {
  EventChannelConfig,
  EventChannelKind,
  EventDiscordPolicy,
  EventMessageConfig,
  EventPingKey,
} from "@droptracker/api-types";

/** JSON with object keys sorted, so key insertion order never reads as a change. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** The editable half of the form — everything the save button sends. */
export type DiscordDraft = {
  guildId: string;
  channels: Partial<Record<EventChannelKind, string>>;
  policy: EventDiscordPolicy;
  pings: Partial<Record<EventPingKey, string[]>>;
  perGroup: boolean;
  messages: EventMessageConfig | null;
};

/** Sections that can carry unsaved edits. `scoping` is the per-clan checkbox,
 * which sits above the collapsible sections and so has no header chip. */
export type DirtySection =
  | "scoping"
  | "channels"
  | "scheduled"
  | "pings"
  | "verbosity"
  | "leaderboard";

export const DIRTY_SECTIONS: readonly DirtySection[] = [
  "scoping",
  "channels",
  "scheduled",
  "pings",
  "verbosity",
  "leaderboard",
];

/**
 * One normalized fingerprint per section.
 *
 * `scope` matters: a clan's own scope (web48a per-group mode) only saves its
 * guild, channels and verbosity — the event-level knobs (scheduled-event
 * policy, role pings, the per-clan checkbox) are hidden there and rejected by
 * the backend with a `group_id`, so stale values left behind by a scope
 * switch must not count as pending edits. Likewise a cleared guild drops its
 * channels and pings on save, so it drops them here too.
 */
export function sectionFingerprints(
  draft: DiscordDraft,
  scope: number | null,
): Record<DirtySection, string> {
  const guild = draft.guildId.trim();
  const shared = scope === null;
  const pingRoles = (key: EventPingKey) =>
    guild && shared ? [...(draft.pings[key] ?? [])].sort() : [];
  return {
    scoping: stableJson(shared ? draft.perGroup : null),
    channels: stableJson({
      guild,
      channels: guild
        ? Object.fromEntries(
            Object.entries(draft.channels)
              .filter(([, v]) => v?.trim())
              .map(([k, v]) => [k, v!.trim()]),
          )
        : {},
    }),
    scheduled: stableJson({
      policy: shared ? draft.policy : null,
      event_created: pingRoles("event_created"),
    }),
    pings: stableJson({
      event_started: pingRoles("event_started"),
      event_ended: pingRoles("event_ended"),
    }),
    verbosity: stableJson({
      toggles: draft.messages?.toggles ?? null,
      task_progress: draft.messages?.task_progress ?? null,
      item_details: draft.messages?.item_details ?? null,
    }),
    leaderboard: stableJson(draft.messages?.leaderboard ?? null),
  };
}

/** The server copy as a draft — the other side of the comparison. Must mirror
 * `applyConfig()` in the form exactly, or the draft reads as dirty on load. */
export function configToDraft(config: EventChannelConfig): DiscordDraft {
  return {
    guildId: config.guild_id ?? "",
    channels: config.channels ?? {},
    policy: config.discord_event_policy ?? "on_activate",
    pings: config.pings ?? {},
    perGroup: config.per_group_discord ?? false,
    messages: config.messages,
  };
}

/** Which sections of `draft` differ from `base` (already fingerprinted). */
export function dirtySections(
  fingerprints: Record<DirtySection, string>,
  base: Record<DirtySection, string> | null,
): DirtySection[] {
  if (!base) return [];
  return DIRTY_SECTIONS.filter((k) => fingerprints[k] !== base[k]);
}
