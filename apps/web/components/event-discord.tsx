"use client";

/**
 * Per-event Discord settings page body (Task 19, events-prd.md D8) — split out
 * of the event manager onto its own page
 * (`/groups/[id]/events/[eventId]/discord`).
 *
 * Guild select is scoped to servers the signed-in user may target — ones they
 * manage on Discord (owner / Manage Server) or whose DropTracker group they
 * administer — intersected with the guilds the bot is in (`bot:guilds`). This
 * still allows a dedicated event server, not just the group's home guild, but
 * not a server the user has no authority over. One channel picker per
 * notification kind. Both lists come from bot-maintained Redis caches via the
 * Web API; when a cache is stale the UI falls back to manual-id entry and the
 * backend asks the bot to warm the cache for the next attempt. The dropdown is
 * only cosmetic — the Web API re-checks guild authority on save.
 *
 * Also edits the event's message-verbosity toggles and live-leaderboard knobs
 * (`messages` on GET/PUT /events/{id}/discord — web_events.message_config).
 * Everything saves through the ONE save button at the bottom.
 */
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  EVENT_CHANNEL_KINDS,
  type DiscordRole,
  type EventChannelConfig,
  type EventChannelKind,
  type EventDiscordPolicy,
  type EventMessageConfig,
  type EventMessageToggleKey,
  type EventPingKey,
  type EventScheduledEventState,
  type EventTaskProgressMode,
} from "@droptracker/api-types";
import type { DiscordChannel, EventDiscordGuild } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";
import { CollapsibleSection } from "@/components/collapsible-section";
import { ChannelListDelayHint, DiscordChannelPicker } from "@/components/discord-channel-picker";
import { DiscordRolePicker } from "@/components/discord-role-picker";
import {
  getEventDiscord,
  listEventDiscordChannels,
  listEventDiscordGuilds,
  listEventDiscordRoles,
  saveEventDiscord,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm outline-none";

const PING_META: Record<EventPingKey, { label: string; hint: string }> = {
  event_created: {
    label: "Discord event created",
    hint: "Pinged in Announcements with a link when the scheduled event appears on the server.",
  },
  event_started: {
    label: "Event started",
    hint: "Pinged on the start announcement.",
  },
  event_ended: {
    label: "Event ended",
    hint: "Pinged on the final-standings announcement.",
  },
};

const KIND_META: Record<EventChannelKind, { label: string; hint: string }> = {
  announcements: {
    label: "Announcements",
    hint: "Event start & end. Also the fallback for every kind below.",
  },
  completions: {
    label: "Completions",
    hint: "Task completions, bingo cells, line & blackout bonuses.",
  },
  leaderboard: {
    label: "Leaderboard",
    hint: "Lead changes with the top-3 standings. A live standings board is posted here when the event starts and kept up to date.",
  },
  admin: {
    label: "Admin",
    hint: "Completions awaiting review (deep-links to the Review queue).",
  },
};

/** One verbosity toggle row — same switch styling as the group-config editor. */
function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="border-osrs-bronze/15 hover:border-osrs-gold/40 bg-osrs-surface-2/50 flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="text-osrs-parchment-dark/60 mt-0.5 block text-xs">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-osrs-gold" : "bg-osrs-stone/50"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

/** Small muted group label inside the verbosity section. */
function ToggleGroupLabel({ children }: { children: string }) {
  return (
    <p className="text-osrs-parchment-dark/50 text-xs font-medium tracking-wide uppercase">
      {children}
    </p>
  );
}

export function EventDiscordSettings({
  groupId,
  eventId,
}: {
  groupId: number | null;
  eventId: number;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const [guilds, setGuilds] = useState<EventDiscordGuild[]>([]);
  const [guildsStale, setGuildsStale] = useState(false);
  const [guildId, setGuildId] = useState("");
  const [guildName, setGuildName] = useState<string | null>(null);
  const [channels, setChannels] = useState<Partial<Record<EventChannelKind, string>>>({});
  const [channelList, setChannelList] = useState<DiscordChannel[]>([]);
  const [channelsStale, setChannelsStale] = useState(false);
  // `null` = follow list availability; explicit choice otherwise.
  const [manualGuild, setManualGuild] = useState<boolean | null>(null);
  // Discord scheduled-event mirror state for the SAVED guild (bot-written).
  const [savedGuildId, setSavedGuildId] = useState("");
  const [scheduledEvent, setScheduledEvent] = useState<EventScheduledEventState | null>(null);
  // When the scheduled event goes live + which roles each post mentions.
  const [policy, setPolicy] = useState<EventDiscordPolicy>("on_activate");
  const [pings, setPings] = useState<Partial<Record<EventPingKey, string[]>>>({});
  const [roleList, setRoleList] = useState<DiscordRole[] | null>(null);
  // Message verbosity + live leaderboard (always fully merged with defaults
  // by the backend; null only until the GET lands).
  const [messages, setMessages] = useState<EventMessageConfig | null>(null);

  // ── per-group scoping (web48a, clan-vs-clan) ──────────────────────────
  // scope null = the shared/host config; a group id = that clan's own
  // channels + verbosity. `meta` comes from the shared-scope GET.
  const [scope, setScope] = useState<number | null>(null);
  const [perGroup, setPerGroup] = useState(false);
  const [meta, setMeta] = useState<{
    isHostAdmin: boolean;
    myGroupIds: number[];
    groups: { group_id: number; name?: string | null; configured: boolean }[];
  } | null>(null);

  const loadChannels = useCallback(
    async (gid: string) => {
      if (!gid) {
        setChannelList([]);
        setChannelsStale(false);
        setRoleList([]);
        return;
      }
      try {
        const res = await listEventDiscordChannels(groupId, gid);
        setChannelList(res.channels);
        setChannelsStale(res.stale);
      } catch {
        // A channel-list failure must never block manual-id entry.
        setChannelList([]);
        setChannelsStale(true);
      }
      try {
        const roles = await listEventDiscordRoles(groupId, gid);
        setRoleList(roles.roles);
      } catch {
        setRoleList([]);
      }
    },
    [groupId],
  );

  const applyConfig = useCallback(
    (config: EventChannelConfig) => {
      setGuildId(config.guild_id ?? "");
      setGuildName(config.guild_name ?? null);
      setChannels(config.channels ?? {});
      setSavedGuildId(config.guild_id ?? "");
      setScheduledEvent(config.scheduled_event ?? null);
      setPolicy(config.discord_event_policy ?? "on_activate");
      setPings(config.pings ?? {});
      setMessages(config.messages);
      if (config.guild_id) void loadChannels(config.guild_id);
      else {
        setChannelList([]);
        setChannelsStale(false);
        setRoleList([]);
      }
    },
    [loadChannels],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [config, guildList] = await Promise.all([
          getEventDiscord(groupId, eventId),
          listEventDiscordGuilds(groupId),
        ]);
        if (cancelled) return;
        setGuilds(guildList.guilds);
        setGuildsStale(guildList.stale);
        setPerGroup(config.per_group_discord ?? false);
        const myGroupIds = config.my_group_ids ?? [];
        setMeta(
          config.groups
            ? {
                isHostAdmin: config.is_host_admin ?? false,
                myGroupIds,
                groups: config.groups,
              }
            : null,
        );
        // A participating clan's admin (not host) lands on their OWN scope
        // when per-group mode is on — that's the only config they should
        // be editing day-to-day.
        if (
          config.per_group_discord &&
          config.is_host_admin === false &&
          myGroupIds.length > 0
        ) {
          const own = await getEventDiscord(groupId, eventId, myGroupIds[0]);
          if (cancelled) return;
          setScope(myGroupIds[0]!);
          applyConfig(own);
        } else {
          applyConfig(config);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, "Couldn't load the Discord config."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, eventId, loadChannels, applyConfig]);

  /** Swap the whole form to another scope (shared or one of my clans). */
  const switchScope = (next: number | null) => {
    if (next === scope) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const config = await getEventDiscord(groupId, eventId, next);
        setScope(next);
        applyConfig(config);
        if (next === null) setPerGroup(config.per_group_discord ?? false);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't load that clan's Discord config."));
      }
    });
  };

  const onPickGuild = (gid: string) => {
    setGuildId(gid);
    setGuildName(guilds.find((g) => g.id === gid)?.name ?? null);
    setChannels({}); // channels belong to the previous guild
    setPings({}); // so do the ping roles
    setSaved(false);
    void loadChannels(gid);
  };

  const togglePingRole = (key: EventPingKey, roleId: string) => {
    setSaved(false);
    setPings((prev) => {
      const current = prev[key] ?? [];
      const next = current.includes(roleId)
        ? current.filter((r) => r !== roleId)
        : [...current, roleId];
      return { ...prev, [key]: next };
    });
  };

  const setKind = (kind: EventChannelKind, value: string) => {
    setSaved(false);
    setChannels((prev) => {
      const next = { ...prev };
      if (value.trim()) next[kind] = value.trim();
      else delete next[kind];
      return next;
    });
  };

  const setToggle = (key: EventMessageToggleKey, value: boolean) => {
    setSaved(false);
    setMessages((prev) =>
      prev ? { ...prev, toggles: { ...prev.toggles, [key]: value } } : prev,
    );
  };

  const setTaskProgress = (mode: EventTaskProgressMode) => {
    setSaved(false);
    setMessages((prev) => (prev ? { ...prev, task_progress: mode } : prev));
  };

  const patchLeaderboard = (patch: Partial<EventMessageConfig["leaderboard"]>) => {
    setSaved(false);
    setMessages((prev) =>
      prev ? { ...prev, leaderboard: { ...prev.leaderboard, ...patch } } : prev,
    );
  };

  const onSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const cleaned = Object.fromEntries(
          Object.entries(channels).filter(([, v]) => v && /^\d+$/.test(v)),
        );
        const cleanedPings = Object.fromEntries(
          Object.entries(pings)
            .map(([k, ids]) => [k, (ids ?? []).filter((id) => /^\d+$/.test(id))])
            .filter(([, ids]) => (ids as string[]).length > 0),
        );
        const result = await saveEventDiscord(groupId, eventId, {
          guild_id: guildId.trim() || null,
          channels: guildId.trim() ? cleaned : {},
          // Event-level knobs only exist in the shared scope; a per-group
          // save carries the clan's own channels + verbosity.
          ...(scope === null
            ? {
                discord_event_policy: policy,
                pings: guildId.trim() ? cleanedPings : {},
                ...(meta?.isHostAdmin ? { per_group_discord: perGroup } : {}),
              }
            : { group_id: scope }),
          // Absent key = leave unchanged, so a failed initial GET can't
          // clobber the stored verbosity config with nothing.
          messages: messages ?? undefined,
        });
        applyConfig(result);
        if (scope === null) setPerGroup(result.per_group_discord ?? false);
        if (scope !== null && meta) {
          // Reflect "configured" on the scope pill without a refetch.
          setMeta({
            ...meta,
            groups: meta.groups.map((g) =>
              g.group_id === scope
                ? { ...g, configured: Object.keys(result.channels ?? {}).length > 0 }
                : g,
            ),
          });
        }
        setSaved(true);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save the Discord config. Please try again."));
      }
    });
  };

  const guildIdValid = !guildId.trim() || /^\d+$/.test(guildId.trim());
  const useManualGuild = manualGuild ?? (guildsStale || guilds.length === 0);
  const hasGuild = Boolean(guildId.trim());

  if (loading) {
    return <p className="text-osrs-parchment-dark/60 text-sm">Loading Discord config…</p>;
  }

  const scopePills =
    meta && perGroup
      ? [
          { id: null as number | null, label: "Shared (host)", configured: true },
          ...meta.groups
            .filter((g) => meta.myGroupIds.includes(g.group_id))
            .map((g) => ({
              id: g.group_id as number | null,
              label: g.name ?? `Clan ${g.group_id}`,
              configured: g.configured,
            })),
        ]
      : null;

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      {/* Per-group clan-vs-clan mode (web48a): the host decides whether each
          clan runs its own channels; admins then pick which scope to edit. */}
      {meta && (meta.isHostAdmin || perGroup) && (
        <div className="border-osrs-bronze/20 space-y-3 rounded border p-3">
          {meta.isHostAdmin && (
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={perGroup}
                disabled={scope !== null}
                onChange={(e) => {
                  setPerGroup(e.target.checked);
                  setSaved(false);
                }}
                className="mt-0.5 size-4"
              />
              <span>
                Each clan configures its own Discord
                <span className="text-osrs-parchment-dark/60 block text-xs">
                  Every participating clan&apos;s admins get their own server, channels and
                  message-verbosity settings for this event — notifications post to every
                  configured clan. Clans without their own config fall back to the shared
                  channels below. Saves with the button at the bottom.
                </span>
              </span>
            </label>
          )}
          {scopePills && (
            <div className="flex flex-wrap items-center gap-1" role="tablist">
              <span className="text-osrs-parchment-dark/60 mr-1 text-xs">Configuring:</span>
              {scopePills.map((pill) => (
                <button
                  key={pill.id ?? "shared"}
                  type="button"
                  role="tab"
                  aria-selected={scope === pill.id}
                  onClick={() => switchScope(pill.id)}
                  disabled={pending}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${
                    scope === pill.id
                      ? "bg-osrs-gold text-osrs-brown-dark"
                      : "text-osrs-parchment-dark/70 hover:text-osrs-gold-bright border-osrs-bronze/30 border"
                  }`}
                >
                  {pill.label}
                  {pill.id !== null && !pill.configured && (
                    <span
                      className="ml-1 opacity-70"
                      title="No channels configured yet — falls back to the shared config"
                    >
                      ○
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {scope !== null && (
            <p className="text-osrs-parchment-dark/60 text-xs">
              You&apos;re editing this clan&apos;s own destinations and verbosity. Scheduled-event
              and ping settings stay on the shared (host) scope.
            </p>
          )}
        </div>
      )}

      <CollapsibleSection
        title="Server & channels"
        hint="Post this event's happenings to a Discord server you manage — including a dedicated event server you've added the bot to. Kinds without a channel fall back to Announcements; with nothing set, nothing is posted."
        defaultOpen
      >
        <div className="space-y-4">
          <label className="block text-sm sm:max-w-md">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Server</span>
            {useManualGuild ? (
              <div className="space-y-1">
                <input
                  value={guildId}
                  onChange={(e) => {
                    setGuildId(e.target.value);
                    setSaved(false);
                  }}
                  onBlur={() => guildIdValid && guildId.trim() && void loadChannels(guildId.trim())}
                  placeholder="Discord server (guild) id"
                  className={`${field} w-full`}
                />
                <p className="text-osrs-parchment-dark/50 text-xs">
                  {guildsStale
                    ? "The bot's server list isn't cached yet — enter the server id manually or try again in a minute."
                    : "Enter a server id you manage (owner / Manage Server). You must have added the bot to it."}{" "}
                  Recently added the bot to a new server? Sign out and back in to refresh your list.
                </p>
                {guilds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setManualGuild(false)}
                    className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs"
                  >
                    Choose from server list instead
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <select
                  value={guilds.some((g) => g.id === guildId) ? guildId : ""}
                  onChange={(e) => onPickGuild(e.target.value)}
                  className={`${field} w-full`}
                >
                  <option value="">— no Discord posting —</option>
                  {guilds.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                {guildId && !guilds.some((g) => g.id === guildId) && (
                  <p className="text-osrs-parchment-dark/50 text-xs">
                    Currently set to {guildName ?? `server ${guildId}`} (not in the cached list).
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setManualGuild(true)}
                  className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs"
                >
                  Enter a server ID manually instead
                </button>
              </div>
            )}
          </label>

          {hasGuild && (
            <div className="grid gap-3 sm:grid-cols-2">
              {EVENT_CHANNEL_KINDS.map((kind) => (
                <label key={kind} className="block text-sm">
                  <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                    {KIND_META[kind].label}
                  </span>
                  <DiscordChannelPicker
                    channels={channelList}
                    value={channels[kind] ?? ""}
                    onChange={(v) => setKind(kind, v)}
                    placeholder={`${KIND_META[kind].label} channel id`}
                  />
                  <span className="text-osrs-parchment-dark/50 mt-1 block text-xs">
                    {KIND_META[kind].hint}
                  </span>
                </label>
              ))}
              {channelsStale && (
                <p className="text-osrs-parchment-dark/50 text-xs sm:col-span-2">
                  This server&apos;s channel list isn&apos;t cached yet (the bot is fetching it) —
                  paste channel ids manually or re-open this page shortly.
                </p>
              )}
              <ChannelListDelayHint className="sm:col-span-2" />
            </div>
          )}
        </div>
      </CollapsibleSection>

      {hasGuild && scope === null && (
        <CollapsibleSection
          title="Scheduled event"
          hint="The bot mirrors this event as a native Discord scheduled event on the server."
        >
          <div className="space-y-4">
            <fieldset className="border-osrs-bronze/20 space-y-2 rounded border p-3 sm:max-w-md">
              <legend className="text-osrs-parchment-dark/70 px-1 text-xs">
                Discord scheduled event
              </legend>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="event-discord-policy"
                  checked={policy === "on_activate"}
                  onChange={() => {
                    setPolicy("on_activate");
                    setSaved(false);
                  }}
                  className="mt-0.5"
                />
                <span>
                  Create when the event goes live
                  <span className="text-osrs-parchment-dark/50 block text-xs">
                    Drafts stay invisible on Discord (recommended).
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="event-discord-policy"
                  checked={policy === "immediate"}
                  onChange={() => {
                    setPolicy("immediate");
                    setSaved(false);
                  }}
                  className="mt-0.5"
                />
                <span>
                  Create right away
                  <span className="text-osrs-parchment-dark/50 block text-xs">
                    The scheduled event appears as soon as this is saved, even for a draft.
                  </span>
                </span>
              </label>
            </fieldset>

            {!scheduledEvent &&
              savedGuildId &&
              guildId.trim() === savedGuildId &&
              policy === "on_activate" && (
                <p className="text-osrs-parchment-dark/50 text-xs">
                  The Discord scheduled event will be created when this event goes live.
                </p>
              )}

            {scheduledEvent && guildId.trim() === savedGuildId && savedGuildId && (
              <>
                {scheduledEvent.status === "failed" ? (
                  <Alert variant="error">
                    The Discord scheduled event couldn&apos;t be created or updated in{" "}
                    {guildName ?? "this server"} — make sure the bot has the{" "}
                    <strong>Manage Events</strong> permission there, then save again.
                    {scheduledEvent.last_error && (
                      <span className="mt-1 block text-xs opacity-70">
                        Last error: {scheduledEvent.last_error}
                      </span>
                    )}
                  </Alert>
                ) : (
                  <p className="text-osrs-parchment-dark/50 text-xs">
                    {scheduledEvent.status === "synced"
                      ? "A Discord scheduled event for this event is live on the server — it tracks name, description and time edits automatically."
                      : scheduledEvent.status === "pending"
                        ? "The bot will create (or update) this server's Discord scheduled event within a minute — once the event has a start time in the future."
                        : "This server's Discord scheduled event is being removed."}
                  </p>
                )}
              </>
            )}

            <div>
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                {PING_META.event_created.label}
                <span className="text-osrs-parchment-dark/40 ml-2">
                  {PING_META.event_created.hint}
                </span>
              </span>
              <DiscordRolePicker
                roles={roleList}
                selected={pings.event_created ?? []}
                onToggle={(id) => togglePingRole("event_created", id)}
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {hasGuild && scope === null && (
        <CollapsibleSection
          title="Announcements & pings"
          hint="Roles mentioned as real pings on the start and final-standings announcements (posted to the Announcements channel)."
        >
          <fieldset className="border-osrs-bronze/20 space-y-3 rounded border p-3">
            <legend className="text-osrs-parchment-dark/70 px-1 text-xs">Role pings</legend>
            {(["event_started", "event_ended"] as const).map((key) => (
              <div key={key}>
                <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                  {PING_META[key].label}
                  <span className="text-osrs-parchment-dark/40 ml-2">{PING_META[key].hint}</span>
                </span>
                <DiscordRolePicker
                  roles={roleList}
                  selected={pings[key] ?? []}
                  onToggle={(id) => togglePingRole(key, id)}
                />
              </div>
            ))}
          </fieldset>
        </CollapsibleSection>
      )}

      {messages && (
        <CollapsibleSection
          title="Message verbosity"
          hint="Choose which notifications this event posts. Applies to this event. Messages post to the channels configured above."
        >
          <div className="space-y-4 sm:max-w-xl">
            <div className="space-y-2">
              <ToggleGroupLabel>Lifecycle</ToggleGroupLabel>
              <ToggleRow
                label="Event started announcement"
                checked={messages.toggles.event_started}
                onChange={(v) => setToggle("event_started", v)}
              />
              <ToggleRow
                label="Event ended + final standings"
                checked={messages.toggles.event_ended}
                onChange={(v) => setToggle("event_ended", v)}
              />
            </div>

            <div className="space-y-2">
              <ToggleGroupLabel>Progress</ToggleGroupLabel>
              <ToggleRow
                label="Task completions"
                hint="One post per completed task, including which bingo tile it marked (Completions channel)."
                checked={messages.toggles.event_completion}
                onChange={(v) => setToggle("event_completion", v)}
              />
              <ToggleRow
                label="Task progress updates"
                hint="Posts while a task is still in progress — pick how often below."
                checked={messages.toggles.event_task_progress}
                onChange={(v) => setToggle("event_task_progress", v)}
              />
              <label className="block pl-4 text-sm sm:max-w-xs">
                <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                  Progress update frequency
                </span>
                <select
                  value={messages.task_progress}
                  onChange={(e) => setTaskProgress(e.target.value as EventTaskProgressMode)}
                  disabled={!messages.toggles.event_task_progress}
                  className={`${field} w-full disabled:opacity-50`}
                >
                  <option value="off">Off</option>
                  <option value="milestones">Milestones (25/50/75%)</option>
                  <option value="all">Every update</option>
                </select>
              </label>
            </div>

            <div className="space-y-2">
              <ToggleGroupLabel>Bingo</ToggleGroupLabel>
              <ToggleRow
                label="Line bonuses"
                checked={messages.toggles.event_line}
                onChange={(v) => setToggle("event_line", v)}
              />
              <ToggleRow
                label="Blackout"
                checked={messages.toggles.event_blackout}
                onChange={(v) => setToggle("event_blackout", v)}
              />
            </div>

            <div className="space-y-2">
              <ToggleGroupLabel>Leaderboard</ToggleGroupLabel>
              <ToggleRow
                label="Lead changes"
                hint="Posted to the Leaderboard channel when a new team takes first place."
                checked={messages.toggles.event_lead_change}
                onChange={(v) => setToggle("event_lead_change", v)}
              />
            </div>

            <div className="space-y-2">
              <ToggleGroupLabel>Admin</ToggleGroupLabel>
              <ToggleRow
                label="Pending review alerts"
                hint="Completions awaiting review, posted to the Admin channel."
                checked={messages.toggles.event_pending}
                onChange={(v) => setToggle("event_pending", v)}
              />
              <ToggleRow
                label="Activation failure alerts"
                checked={messages.toggles.event_activation_failed}
                onChange={(v) => setToggle("event_activation_failed", v)}
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {messages && (
        <CollapsibleSection
          title="Live leaderboard"
          hint="A standings board posted to the Leaderboard channel when the event starts and edited in place as scores change."
        >
          <div className="space-y-3 sm:max-w-xl">
            <ToggleRow
              label="Post a live standings board"
              hint="Requires a Leaderboard channel above (falls back to Announcements)."
              checked={messages.leaderboard.live}
              onChange={(v) => patchLeaderboard({ live: v })}
            />
            {messages.leaderboard.live && !channels.leaderboard && (
              <p className="text-osrs-gold-bright/80 text-xs">
                {channels.announcements
                  ? "No Leaderboard channel is set — the live board will post to Announcements instead."
                  : "No Leaderboard (or Announcements) channel is set — the live board has nowhere to post."}
              </p>
            )}
            <label className="block text-sm sm:max-w-xs">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Teams shown</span>
              <select
                value={messages.leaderboard.top_n}
                onChange={(e) => patchLeaderboard({ top_n: Number(e.target.value) })}
                className={`${field} w-full`}
              >
                {Array.from({ length: 23 }, (_, i) => i + 3).map((n) => (
                  <option key={n} value={n}>
                    Top {n}
                  </option>
                ))}
              </select>
              <span className="text-osrs-parchment-dark/50 mt-1 block text-xs">
                How many teams the board lists (default 10).
              </span>
            </label>
            <ToggleRow
              label="Include task/bingo progress summary"
              checked={messages.leaderboard.show_tasks}
              onChange={(v) => patchLeaderboard({ show_tasks: v })}
            />
          </div>
        </CollapsibleSection>
      )}

      <div className="border-osrs-bronze/20 flex items-center gap-3 border-t pt-4">
        <button
          onClick={onSave}
          disabled={pending || !guildIdValid}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save Discord config"}
        </button>
        {!guildIdValid && <span className="text-osrs-red text-xs">Server id must be numeric.</span>}
        {saved && <span className="text-osrs-gold-bright text-xs">Saved.</span>}
      </div>
    </div>
  );
}
