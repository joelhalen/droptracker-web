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
  type EventTeamDiscordConfig,
  type EventTeamDiscordInput,
  type EventTeamDiscordRetention,
  type TeamDiscordTeamState,
} from "@droptracker/api-types";
import type { DiscordChannel, EventDiscordGuild } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";
import { CollapsibleSection } from "@/components/collapsible-section";
import { EventLayoutOverrides } from "@/components/event-layout-editor";
import { ChannelListDelayHint, DiscordChannelPicker } from "@/components/discord-channel-picker";
import { DiscordRolePicker } from "@/components/discord-role-picker";
import {
  getEventDiscord,
  getEventTeamDiscord,
  listEventDiscordChannels,
  listEventDiscordGuilds,
  listEventDiscordRoles,
  saveEventDiscord,
  saveEventTeamDiscord,
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
  disabled = false,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="border-osrs-bronze/15 hover:border-osrs-gold/40 bg-osrs-surface-2/50 flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-osrs-bronze/15"
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

/** Provisioning-state chip for one team's row in "Team channels & roles".
 * The bot writes sync_status back as it works; nothing provisioned yet
 * (null) renders as a dash. */
function TeamSyncStatus({ team }: { team: TeamDiscordTeamState }) {
  if (team.sync_status === "failed") {
    return (
      <span
        className="border-osrs-red/40 bg-osrs-red/10 text-osrs-red rounded border px-1.5 py-px text-[10px] font-semibold"
        title={team.last_error ?? "The bot couldn't provision this team — check its permissions and save again."}
      >
        failed
      </span>
    );
  }
  if (team.sync_status === "pending") {
    return <span className="text-osrs-parchment-dark/60 text-xs">creating…</span>;
  }
  if (team.sync_status === "delete_pending") {
    return <span className="text-osrs-parchment-dark/60 text-xs">removing…</span>;
  }
  if (team.sync_status === "synced") {
    return (
      <span className="flex flex-wrap items-center gap-x-2 text-xs">
        {team.role_id && (
          <span className="text-osrs-gold-bright whitespace-nowrap" title={`Role id ${team.role_id}`}>
            @role ✓
          </span>
        )}
        {team.channel_id && (
          <span
            className="text-osrs-gold-bright whitespace-nowrap"
            title={`${team.channel_kind === "thread" ? "Thread" : "Channel"} id ${team.channel_id}`}
          >
            {team.channel_kind === "thread" ? "🧵 thread ✓" : "#channel ✓"}
          </span>
        )}
        {!team.role_id && !team.channel_id && (
          <span className="text-osrs-gold-bright">synced</span>
        )}
      </span>
    );
  }
  return <span className="text-osrs-parchment-dark/40 text-xs">—</span>;
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

  // ── per-team channels & roles (web53a) ────────────────────────────────
  // `teamDiscord` is the editable draft; `teamDiscordBase` is the last
  // server copy, so the save can diff and only send changed keys (the PUT
  // merges — absent keys leave stored values, incl. captain toggles, alone).
  const [teamDiscord, setTeamDiscord] = useState<EventTeamDiscordConfig | null>(null);
  const [teamDiscordBase, setTeamDiscordBase] = useState<EventTeamDiscordConfig | null>(null);
  const [teamDiscordError, setTeamDiscordError] = useState<string | null>(null);

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

  // Team channels & roles load is scope-aware exactly like the main config:
  // keyed on `scope` so switching pills refetches that clan's own copy.
  useEffect(() => {
    let cancelled = false;
    setTeamDiscord(null);
    setTeamDiscordBase(null);
    setTeamDiscordError(null);
    (async () => {
      try {
        const cfg = await getEventTeamDiscord(groupId, eventId, scope);
        if (cancelled) return;
        setTeamDiscord(cfg);
        setTeamDiscordBase(cfg);
      } catch (err) {
        if (!cancelled) {
          setTeamDiscordError(
            getErrorMessage(err, "Couldn't load the team channels & roles config."),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, eventId, scope]);

  const patchTeamDiscord = (patch: Partial<EventTeamDiscordConfig>) => {
    setSaved(false);
    setTeamDiscord((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const setTeamFlag = (teamId: number, field: "role_enabled" | "channel_enabled", v: boolean) => {
    setSaved(false);
    setTeamDiscord((prev) =>
      prev
        ? {
            ...prev,
            teams: prev.teams.map((t) => (t.team_id === teamId ? { ...t, [field]: v } : t)),
          }
        : prev,
    );
  };

  /** Only the keys the admin actually changed vs. the server copy — the PUT
   * merges, so untouched knobs (and captain-owned toggles) stay intact. */
  const teamDiscordDiff = (): EventTeamDiscordInput | null => {
    if (!teamDiscord || !teamDiscordBase) return null;
    const input: EventTeamDiscordInput = {};
    if (teamDiscord.channels_enabled !== teamDiscordBase.channels_enabled)
      input.channels_enabled = teamDiscord.channels_enabled;
    if (teamDiscord.roles_enabled !== teamDiscordBase.roles_enabled)
      input.roles_enabled = teamDiscord.roles_enabled;
    if (teamDiscord.forum_channel_id !== teamDiscordBase.forum_channel_id)
      input.forum_channel_id = teamDiscord.forum_channel_id;
    if (teamDiscord.retention !== teamDiscordBase.retention)
      input.retention = teamDiscord.retention;
    if (teamDiscord.captain_config !== teamDiscordBase.captain_config)
      input.captain_config = teamDiscord.captain_config;
    const baseTeams = new Map(teamDiscordBase.teams.map((t) => [t.team_id, t]));
    const changedTeams: NonNullable<EventTeamDiscordInput["teams"]> = {};
    for (const t of teamDiscord.teams) {
      const base = baseTeams.get(t.team_id);
      const entry: { role?: boolean; channel?: boolean } = {};
      if (!base || t.role_enabled !== base.role_enabled) entry.role = t.role_enabled;
      if (!base || t.channel_enabled !== base.channel_enabled) entry.channel = t.channel_enabled;
      if (Object.keys(entry).length > 0) changedTeams[String(t.team_id)] = entry;
    }
    if (Object.keys(changedTeams).length > 0) input.teams = changedTeams;
    if (Object.keys(input).length === 0) return null;
    if (scope !== null) input.group_id = scope;
    return input;
  };

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

  // The board-game keys are in EVENT_MESSAGE_TOGGLE_KEYS but not (yet) in
  // EventMessageConfigSchema's closed toggles object, so they're absent from
  // the inferred type — read them defensively with their documented defaults
  // (turn posts on, roll prompts OFF for main channels).
  const boardToggle = (key: "event_board_turn" | "event_board_roll_prompt", fallback: boolean) =>
    (messages?.toggles as Partial<Record<EventMessageToggleKey, boolean>> | undefined)?.[key] ??
    fallback;

  const setTaskProgress = (mode: EventTaskProgressMode) => {
    setSaved(false);
    setMessages((prev) => (prev ? { ...prev, task_progress: mode } : prev));
  };

  const setItemDetails = (value: boolean) => {
    setSaved(false);
    setMessages((prev) => (prev ? { ...prev, item_details: value } : prev));
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
        // Team channels & roles ride the same save button — only PUT when
        // the section's draft actually changed (the endpoint merges).
        const teamInput = teamDiscordDiff();
        if (teamInput) {
          try {
            const teamResult = await saveEventTeamDiscord(groupId, eventId, teamInput);
            setTeamDiscord(teamResult);
            setTeamDiscordBase(teamResult);
            setTeamDiscordError(null);
          } catch (err) {
            // Typically the backend's 422: enabling roles/channels for a
            // scope with no guild configured. The main config DID save.
            setTeamDiscordError(
              getErrorMessage(
                err,
                "Couldn't save the team channels & roles settings. Please try again.",
              ),
            );
            setError(
              "The channel config saved, but the team channels & roles section didn't — see the note there.",
            );
            return;
          }
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

      <CollapsibleSection
        title="Team channels & roles"
        hint="Auto-provision a private channel and a mentionable role for every team on this event's server. The bot creates them, keeps them in sync with rosters, and can clean them up after the event. Saves with the button at the bottom."
      >
        {teamDiscord ? (
          <div className="space-y-4 sm:max-w-xl">
            {teamDiscordError && <Alert variant="error">{teamDiscordError}</Alert>}
            {!hasGuild && (
              <p className="text-osrs-gold-bright/80 text-xs">
                Pick a server under &ldquo;Server &amp; channels&rdquo; first — team roles and
                channels are created there.
              </p>
            )}
            <ToggleRow
              label="Create team roles"
              hint="Auto-creates one mentionable role per team (team name + color); the bot keeps membership in sync with rosters."
              checked={teamDiscord.roles_enabled}
              onChange={(v) => patchTeamDiscord({ roles_enabled: v })}
              disabled={!hasGuild && !teamDiscord.roles_enabled}
            />
            <ToggleRow
              label="Create team channels"
              hint="A private text channel per team (visible to the team role), or threads inside a forum channel."
              checked={teamDiscord.channels_enabled}
              onChange={(v) => patchTeamDiscord({ channels_enabled: v })}
              disabled={!hasGuild && !teamDiscord.channels_enabled}
            />

            {teamDiscord.channels_enabled && (
              <div className="block pl-4 text-sm sm:max-w-md">
                <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                  Forum channel (optional)
                </span>
                <DiscordChannelPicker
                  channels={channelList}
                  mode="forum"
                  value={teamDiscord.forum_channel_id ?? ""}
                  onChange={(v) => patchTeamDiscord({ forum_channel_id: v.trim() || null })}
                  placeholder="Forum channel id"
                />
                <span className="text-osrs-parchment-dark/50 mt-1 block text-xs">
                  When set, the bot creates one thread per team inside this forum instead of
                  separate text channels.
                </span>
                {teamDiscord.forum_channel_id && (
                  <button
                    type="button"
                    onClick={() => patchTeamDiscord({ forum_channel_id: null })}
                    className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright mt-1 text-xs"
                  >
                    Clear — use separate text channels instead
                  </button>
                )}
              </div>
            )}

            <label className="block text-sm sm:max-w-md">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                After the event ends
              </span>
              <select
                value={teamDiscord.retention}
                onChange={(e) =>
                  patchTeamDiscord({ retention: e.target.value as EventTeamDiscordRetention })
                }
                className={`${field} w-full`}
              >
                <option value="delete_48h">Delete after 48 hours (default)</option>
                <option value="keep">Keep roles &amp; channels</option>
              </select>
              <span className="text-osrs-parchment-dark/50 mt-1 block text-xs">
                With the default, pings stay usable for wrap-up for two days, then the bot cleans
                everything up.
              </span>
            </label>

            <ToggleRow
              label="Team captains can configure notifications"
              hint="Leaders and co-leaders can tune which notifications their team's channel receives, from their team page. Only meaningful when the leadership feature is enabled for this event."
              checked={teamDiscord.captain_config}
              onChange={(v) => patchTeamDiscord({ captain_config: v })}
            />

            {teamDiscord.teams.length > 0 && (
              <div className="border-osrs-bronze/20 overflow-hidden rounded border">
                <div className="text-osrs-parchment-dark/50 border-osrs-bronze/20 grid grid-cols-[minmax(0,1fr)_auto_auto_minmax(5rem,auto)] items-center gap-x-4 border-b px-3 py-1.5 text-[10px] font-medium tracking-wide uppercase">
                  <span>Team</span>
                  <span>Role</span>
                  <span>Channel</span>
                  <span>Status</span>
                </div>
                <ul className="divide-osrs-bronze/15 divide-y">
                  {teamDiscord.teams.map((t) => (
                    <li
                      key={t.team_id}
                      className="grid grid-cols-[minmax(0,1fr)_auto_auto_minmax(5rem,auto)] items-center gap-x-4 px-3 py-2 text-sm"
                    >
                      <span className="truncate">{t.name}</span>
                      <input
                        type="checkbox"
                        aria-label={`Role for ${t.name}`}
                        checked={t.role_enabled}
                        onChange={(e) => setTeamFlag(t.team_id, "role_enabled", e.target.checked)}
                        className="size-4 justify-self-center"
                      />
                      <input
                        type="checkbox"
                        aria-label={`Channel for ${t.name}`}
                        checked={t.channel_enabled}
                        onChange={(e) =>
                          setTeamFlag(t.team_id, "channel_enabled", e.target.checked)
                        }
                        className="size-4 justify-self-center"
                      />
                      <TeamSyncStatus team={t} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {teamDiscord.teams.length === 0 && (
              <p className="text-osrs-parchment-dark/50 text-xs">
                No teams yet — per-team switches appear here once the event has teams.
              </p>
            )}
            <p className="text-osrs-parchment-dark/60 text-xs">
              The bot provisions roles and channels within ~30 seconds of saving — reload this page
              to see linked roles/channels and statuses update.
            </p>
          </div>
        ) : teamDiscordError ? (
          <Alert variant="error">{teamDiscordError}</Alert>
        ) : (
          <p className="text-osrs-parchment-dark/60 text-sm">Loading team channel config…</p>
        )}
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
                label="Item & contribution details"
                hint="On completion posts, name the item that finished the task and how much of the requirement it filled. Contributors are always listed."
                checked={messages.item_details}
                onChange={setItemDetails}
                disabled={!messages.toggles.event_completion}
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
              <ToggleGroupLabel>Bingo & board</ToggleGroupLabel>
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
              <ToggleRow
                label="Board: dice rolls"
                hint="Board-game events: a post whenever a team rolls and moves."
                checked={boardToggle("event_board_turn", true)}
                onChange={(v) => setToggle("event_board_turn", v)}
              />
              <ToggleRow
                label="Board: roll prompts"
                hint="Nudge when a team finishes its task and can roll — off by default here; team channels carry it by default."
                checked={boardToggle("event_board_roll_prompt", false)}
                onChange={(v) => setToggle("event_board_roll_prompt", v)}
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

      {scope === null && (
        <CollapsibleSection
          title="Message layouts"
          hint="Customize how this event's Discord messages look — overrides your group's default layouts for this event only. Saved instantly, separate from the config below."
        >
          <EventLayoutOverrides groupId={groupId} eventId={eventId} />
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
