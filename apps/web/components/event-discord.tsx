"use client";

/**
 * Per-event Discord destination config (Task 19, events-prd.md D8).
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
 */
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  EVENT_CHANNEL_KINDS,
  type EventChannelKind,
} from "@droptracker/api-types";
import type { DiscordChannel, EventDiscordGuild } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";
import { DiscordChannelPicker } from "@/components/discord-channel-picker";
import {
  getEventDiscord,
  listEventDiscordChannels,
  listEventDiscordGuilds,
  saveEventDiscord,
} from "@/app/(admin)/groups/[id]/events/actions";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm outline-none";

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
    hint: "Lead changes with the top-3 standings.",
  },
  admin: {
    label: "Admin",
    hint: "Completions awaiting review (deep-links to the Review queue).",
  },
};

export function EventDiscord({ groupId, eventId }: { groupId: number | null; eventId: number }) {
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

  const loadChannels = useCallback(
    async (gid: string) => {
      if (!gid) {
        setChannelList([]);
        setChannelsStale(false);
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
    },
    [groupId],
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
        setGuildId(config.guild_id ?? "");
        setGuildName(config.guild_name ?? null);
        setChannels(config.channels ?? {});
        if (config.guild_id) void loadChannels(config.guild_id);
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
  }, [groupId, eventId, loadChannels]);

  const onPickGuild = (gid: string) => {
    setGuildId(gid);
    setGuildName(guilds.find((g) => g.id === gid)?.name ?? null);
    setChannels({}); // channels belong to the previous guild
    setSaved(false);
    void loadChannels(gid);
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

  const onSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const cleaned = Object.fromEntries(
          Object.entries(channels).filter(([, v]) => v && /^\d+$/.test(v)),
        );
        const result = await saveEventDiscord(groupId, eventId, {
          guild_id: guildId.trim() || null,
          channels: guildId.trim() ? cleaned : {},
        });
        setGuildId(result.guild_id ?? "");
        setGuildName(result.guild_name ?? null);
        setChannels(result.channels ?? {});
        setSaved(true);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save the Discord config. Please try again."));
      }
    });
  };

  const guildIdValid = !guildId.trim() || /^\d+$/.test(guildId.trim());
  const useManualGuild = manualGuild ?? (guildsStale || guilds.length === 0);

  return (
    <section>
      <h3 className="heading-rule text-osrs-gold mb-1 pb-1 text-lg font-semibold">Discord</h3>
      <p className="text-osrs-parchment-dark/60 mb-4 text-sm">
        Post this event&apos;s happenings to a Discord server you manage — including a dedicated
        event server you&apos;ve added the bot to. Kinds without a channel fall back to
        Announcements; with nothing set, nothing is posted.
      </p>

      {loading ? (
        <p className="text-osrs-parchment-dark/60 text-sm">Loading Discord config…</p>
      ) : (
        <div className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

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

          {guildId.trim() && (
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
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={onSave}
              disabled={pending || !guildIdValid}
              className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save Discord config"}
            </button>
            {!guildIdValid && (
              <span className="text-osrs-red text-xs">Server id must be numeric.</span>
            )}
            {saved && <span className="text-osrs-gold-bright text-xs">Saved.</span>}
          </div>
        </div>
      )}
    </section>
  );
}
