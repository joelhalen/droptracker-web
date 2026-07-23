"use client";

/**
 * Shared guided group-setup wizard — the ONE implementation rendered by the
 * site (/groups/new) and the Discord Activity (group-setup view). Transport
 * and navigation are injected via ports.ts; see the rules there.
 *
 * Step shape follows the events setup wizard: an explicit STEPS array,
 * progressive commit (the group is created on leaving the Identity step, with
 * the created id memoized so a retry never duplicates), and post-create
 * configuration steps that write immediately.
 *
 * In the Activity the launch guild is known from the SDK context, so the
 * Server step collapses to a confirmation card.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";
import {
  ChannelListDelayHint,
  DiscordChannelPicker,
} from "@/components/discord-channel-picker";
import type {
  DiscordChannel,
  GroupSetupClient,
  GuildStatus,
  ManageableGuild,
  SetupEnv,
  WomGroupPreview,
} from "./ports";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";
const primaryBtn =
  "bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50";
const ghostBtn =
  "border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-4 py-2 text-sm disabled:opacity-50";

const INVITE_FALLBACK_URL = "https://www.droptracker.io/invite";
const PLUGIN_URL = "https://www.droptracker.io/runelite";
const DOCS_URL = "https://www.droptracker.io/docs";

type StepKey = "server" | "wom" | "identity" | "channels" | "finish";

const STEPS: { key: StepKey; label: string; blurb: string }[] = [
  {
    key: "server",
    label: "Discord server",
    blurb: "Pick the server your clan lives in and make sure the DropTracker bot is inside.",
  },
  {
    key: "wom",
    label: "WOM group",
    blurb: "Link your Wise Old Man group so we can sync your member list automatically.",
  },
  {
    key: "identity",
    label: "Identity",
    blurb: "Name your group. This creates it — everything after is configuration.",
  },
  {
    key: "channels",
    label: "Channels",
    blurb: "Choose where the lootboard and drop notifications should post. You can skip this.",
  },
  { key: "finish", label: "Finish", blurb: "You're live! A few pointers for what's next." },
];

/** Accept a bare id or a pasted wise-old-man.net group URL. */
function parseWomId(raw: string): number | null {
  const trimmed = raw.trim();
  const urlMatch = trimmed.match(/wise-?old-?man\.net\/groups\/(\d+)/i);
  const digits = urlMatch ? urlMatch[1] : trimmed.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// Invite-poll cadence: ~2 minutes of 5s probes before offering a manual retry.
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX = 24;

export function GroupSetupWizard({
  client,
  env,
  launchGuild = null,
  initialGroupId = null,
  initialStep = 0,
}: {
  client: GroupSetupClient;
  env: SetupEnv;
  /** Activity: the launch guild — collapses the Server step to a confirmation. */
  launchGuild?: { id: string; name?: string | null } | null;
  /** Site resume (?group&step): jump back into a created group's config steps. */
  initialGroupId?: number | null;
  initialStep?: number;
}) {
  const createdGroupIdRef = useRef<number | null>(initialGroupId);
  const [createdGroupId, setCreatedGroupId] = useState<number | null>(initialGroupId);
  const created = createdGroupId != null;

  const clampStep = useCallback(
    (idx: number) => {
      const max = createdGroupIdRef.current != null ? STEPS.length - 1 : 2;
      return Math.max(0, Math.min(idx, max));
    },
    [],
  );
  const [stepIdx, setStepIdx] = useState(() =>
    Math.max(0, Math.min(initialGroupId != null ? initialStep : Math.min(initialStep, 2), STEPS.length - 1)),
  );
  const step = STEPS[stepIdx] ?? STEPS[0]!;

  // --- Server step state ---
  const [guilds, setGuilds] = useState<ManageableGuild[] | null>(null);
  const [guildsCached, setGuildsCached] = useState(true);
  const [guildId, setGuildId] = useState(launchGuild?.id ?? "");
  const [manualGuildId, setManualGuildId] = useState("");
  const [status, setStatus] = useState<GuildStatus | null>(null);
  const [checkingGuild, setCheckingGuild] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [polling, setPolling] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  // --- WOM step state ---
  const [womInput, setWomInput] = useState("");
  const [wom, setWom] = useState<WomGroupPreview | null>(null);
  const [womLoading, setWomLoading] = useState(false);

  // --- Identity step state ---
  const [name, setName] = useState("");
  const [discordUrl, setDiscordUrl] = useState("");
  const [creating, setCreating] = useState(false);

  // --- Channels step state ---
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [channelsCached, setChannelsCached] = useState(true);
  const [channelsLoaded, setChannelsLoaded] = useState(false);
  const [lootboardChannel, setLootboardChannel] = useState("");
  const [dropsChannel, setDropsChannel] = useState("");
  const [savingChannels, setSavingChannels] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const persist = useCallback(
    (idx: number) => env.persistStep?.({ groupId: createdGroupIdRef.current, step: idx }),
    [env],
  );

  const gotoStep = useCallback(
    (idx: number) => {
      const next = clampStep(idx);
      setError(null);
      setStepIdx(next);
      persist(next);
    },
    [clampStep, persist],
  );

  // Load the server picker (site only — the Activity knows its guild).
  useEffect(() => {
    if (launchGuild) return;
    let alive = true;
    client
      .manageableGuilds()
      .then((res) => {
        if (!alive) return;
        setGuilds(res.guilds);
        setGuildsCached(res.cached);
      })
      .catch(() => {
        if (!alive) return;
        setGuilds([]);
        setGuildsCached(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkGuild = useCallback(
    async (gid: string, opts?: { refresh?: boolean }) => {
      if (!gid) return null;
      setCheckingGuild(true);
      try {
        const s = await client.guildStatus(gid, opts);
        setStatus(s);
        return s;
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't check that Discord server. Please try again."));
        return null;
      } finally {
        setCheckingGuild(false);
      }
    },
    [client],
  );

  // Auto-check the launch guild (Activity) or a resumed selection once.
  useEffect(() => {
    if (guildId && !status && !created) void checkGuild(guildId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  // Poll-until-present after "Invite the bot" (refresh=1 busts the 5-min
  // presence cache server-side). Stops on success, step change, or cap.
  useEffect(() => {
    if (!polling || step.key !== "server") return;
    if (status?.bot_present) {
      setPolling(false);
      return;
    }
    if (pollCount >= POLL_MAX) {
      setPolling(false);
      return;
    }
    const t = setTimeout(async () => {
      setPollCount((c) => c + 1);
      await checkGuild(guildId, { refresh: true });
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [polling, pollCount, status, step.key, guildId, checkGuild]);

  const onInviteBot = useCallback(async () => {
    let base = INVITE_FALLBACK_URL;
    try {
      const invite = inviteUrl ?? (await client.botInvite()).invite_url;
      setInviteUrl(invite);
      base = invite;
    } catch {
      // Fallback keeps the button working even if the meta endpoint is down.
    }
    const url = base.includes("client_id")
      ? `${base}&guild_id=${encodeURIComponent(guildId)}&disable_guild_select=true`
      : base;
    env.openLink(url);
    setPollCount(0);
    setPolling(true);
  }, [client, env, guildId, inviteUrl]);

  const selectGuild = useCallback(
    (gid: string) => {
      setGuildId(gid);
      setStatus(null);
      setPolling(false);
      setPollCount(0);
      setError(null);
      void checkGuild(gid);
    },
    [checkGuild],
  );

  const onLookupWom = useCallback(async () => {
    const womId = parseWomId(womInput);
    if (!womId) {
      setError("Enter your Wise Old Man group id (or paste its group page URL).");
      return;
    }
    setWomLoading(true);
    setError(null);
    try {
      const preview = await client.lookupWom(womId);
      setWom(preview);
      if (!name) setName(preview.name.slice(0, 30));
      if (preview.already_registered) {
        setError("This WOM group is already registered with DropTracker.");
      }
    } catch (err) {
      setError(
        getErrorMessage(err, "Couldn't find that Wise Old Man group. Check the id and try again."),
      );
    } finally {
      setWomLoading(false);
    }
  }, [client, name, womInput]);

  const onCreate = useCallback(async () => {
    // Retry-safe: a created group is never created twice (events-wizard trick).
    if (createdGroupIdRef.current != null) {
      gotoStep(3);
      return;
    }
    if (!wom || !status) return;
    setCreating(true);
    setError(null);
    try {
      const res = await client.createGroup({
        name: name.trim(),
        wom_id: wom.wom_id,
        guild_id: guildId,
        discord_url: discordUrl.trim(),
      });
      createdGroupIdRef.current = res.id;
      setCreatedGroupId(res.id);
      setStepIdx(3);
      env.persistStep?.({ groupId: res.id, step: 3 });
    } catch (err) {
      setError(
        getErrorMessage(err, "Couldn't create the group. Please try again.") +
          " If this mentions an existing group, use Back to adjust the server or WOM steps.",
      );
    } finally {
      setCreating(false);
    }
  }, [client, discordUrl, env, gotoStep, guildId, name, status, wom]);

  // Fetch the channel list when entering the Channels step.
  useEffect(() => {
    if (step.key !== "channels" || channelsLoaded || createdGroupId == null) return;
    let alive = true;
    client
      .listChannels(createdGroupId)
      .then((res) => {
        if (!alive) return;
        setChannels(res.channels);
        setChannelsCached(res.cached);
        setChannelsLoaded(true);
      })
      .catch(() => {
        if (!alive) return;
        setChannels([]);
        setChannelsCached(false);
        setChannelsLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [step.key, channelsLoaded, createdGroupId, client]);

  const onSaveChannels = useCallback(async () => {
    if (createdGroupId == null) return;
    const patch: Record<string, string | null> = {};
    if (lootboardChannel) patch.lootboard_channel_id = lootboardChannel;
    if (dropsChannel) patch.channel_id_to_post_loot = dropsChannel;
    if (Object.keys(patch).length === 0) {
      gotoStep(4);
      return;
    }
    setSavingChannels(true);
    setError(null);
    try {
      await client.saveConfig(createdGroupId, patch);
      gotoStep(4);
    } catch (err) {
      setError(
        getErrorMessage(err, "Couldn't save the channel settings.") +
          " You can skip for now and set channels later in group settings.",
      );
    } finally {
      setSavingChannels(false);
    }
  }, [client, createdGroupId, dropsChannel, gotoStep, lootboardChannel]);

  const serverReady = Boolean(status?.bot_present && !status?.owns_group);
  const womReady = Boolean(wom && !wom.already_registered);
  const identityReady = name.trim().length >= 1 && name.trim().length <= 30;

  const stepDone = useMemo(
    () => [serverReady, womReady, created, created, false],
    [serverReady, womReady, created],
  );

  const guildDisplayName =
    launchGuild?.name ??
    guilds?.find((g) => g.id === guildId)?.name ??
    (guildId ? `Server ${guildId}` : null);

  return (
    <div className="space-y-6">
      {/* Step rail */}
      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((s, i) => {
          const reachable = i <= 2 ? !created : created;
          const isCurrent = i === stepIdx;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => reachable && gotoStep(i)}
                disabled={!reachable && !isCurrent}
                className={`rounded px-2 py-1 ${
                  isCurrent
                    ? "bg-osrs-bronze text-osrs-parchment"
                    : stepDone[i]
                      ? "text-osrs-green"
                      : "text-osrs-parchment-dark/50"
                } ${reachable && !isCurrent ? "hover:text-osrs-gold-bright" : ""}`}
              >
                {i + 1}. {s.label}
                {stepDone[i] && !isCurrent ? " ✓" : ""}
              </button>
            </li>
          );
        })}
      </ol>

      <p className="text-osrs-parchment-dark/70 text-sm">{step.blurb}</p>

      {error && <Alert variant="error">{error}</Alert>}

      {/* ── Step 1: Discord server ─────────────────────────────────────── */}
      {step.key === "server" && (
        <div className="space-y-4">
          {launchGuild ? (
            <div className="border-osrs-bronze/40 bg-osrs-brown-dark/40 rounded border p-3">
              <p className="text-sm">
                Setting up DropTracker for <strong>{launchGuild.name ?? "this server"}</strong>.
              </p>
              <p className="text-osrs-parchment-dark/60 mt-1 text-xs">
                Detected from where you launched the app.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {guilds === null && (
                <p className="text-osrs-parchment-dark/60 text-sm">Loading your servers…</p>
              )}
              {guilds !== null && guilds.length > 0 && (
                <div className="space-y-2">
                  {guilds.map((g) => (
                    <label
                      key={g.id}
                      className={`border-osrs-bronze/40 hover:border-osrs-gold flex cursor-pointer items-center gap-3 rounded border p-2 ${
                        guildId === g.id ? "border-osrs-gold bg-osrs-brown-dark/40" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="guild"
                        checked={guildId === g.id}
                        onChange={() => selectGuild(g.id)}
                      />
                      {g.icon_url ? (
                        <img src={g.icon_url} alt="" className="h-6 w-6 rounded-full" />
                      ) : (
                        <span className="bg-osrs-bronze/30 flex h-6 w-6 items-center justify-center rounded-full text-[10px]">
                          {g.name.slice(0, 2)}
                        </span>
                      )}
                      <span className="flex-1 text-sm">{g.name}</span>
                      {g.has_group && (
                        <span className="text-osrs-gold-bright text-xs">has a group</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
              {guilds !== null && guilds.length === 0 && (
                <Alert variant="info">
                  {guildsCached
                    ? "We couldn't find any Discord servers you manage."
                    : "Your server list isn't available for this session — sign out and back in, or paste your server id below."}
                </Alert>
              )}
              <details className="text-sm" open={guilds !== null && guilds.length === 0}>
                <summary className="text-osrs-parchment-dark/70 cursor-pointer">
                  Paste a server id instead
                </summary>
                <div className="mt-2 flex gap-2">
                  <input
                    value={manualGuildId}
                    onChange={(e) => setManualGuildId(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 207526562331885568"
                    inputMode="numeric"
                    className={field}
                  />
                  <button
                    type="button"
                    className={ghostBtn}
                    disabled={!manualGuildId}
                    onClick={() => selectGuild(manualGuildId)}
                  >
                    Use
                  </button>
                </div>
              </details>
            </div>
          )}

          {guildId && (
            <div className="space-y-2">
              {checkingGuild && !polling && (
                <p className="text-osrs-parchment-dark/60 text-sm">Checking {guildDisplayName}…</p>
              )}
              {status?.owns_group && (
                <Alert variant="info">
                  <span>
                    That server already runs a DropTracker group.{" "}
                    <button
                      type="button"
                      className="text-osrs-gold-bright underline"
                      onClick={() => status.group_id && env.goToGroup(status.group_id, { admin: true })}
                    >
                      Open its admin panel
                    </button>{" "}
                    instead.
                  </span>
                </Alert>
              )}
              {status && !status.owns_group && status.bot_present && (
                <p className="text-osrs-green text-sm">The DropTracker bot is in this server. ✓</p>
              )}
              {status && !status.owns_group && !status.bot_present && (
                <div className="space-y-2">
                  <Alert variant="info">
                    The DropTracker bot isn&apos;t in this server yet — invite it, then come back
                    here. We&apos;ll detect it automatically.
                  </Alert>
                  <div className="flex items-center gap-3">
                    <button type="button" className={primaryBtn} onClick={onInviteBot}>
                      Invite the DropTracker bot
                    </button>
                    {polling && (
                      <span className="text-osrs-parchment-dark/60 text-xs">
                        Watching for the bot to join…
                      </span>
                    )}
                    {!polling && pollCount >= POLL_MAX && (
                      <button
                        type="button"
                        className={ghostBtn}
                        onClick={() => {
                          setPollCount(0);
                          setPolling(true);
                        }}
                      >
                        Still not seeing it — retry
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              className={primaryBtn}
              disabled={!serverReady}
              onClick={() => gotoStep(1)}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: WOM group ──────────────────────────────────────────── */}
      {step.key === "wom" && (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Wise Old Man group id or URL</span>
            <input
              value={womInput}
              onChange={(e) => setWomInput(e.target.value)}
              placeholder="e.g. 1234 or https://wiseoldman.net/groups/1234"
              className={field}
            />
          </label>
          <p className="text-osrs-parchment-dark/60 text-xs">
            No WOM group yet?{" "}
            <button
              type="button"
              className="text-osrs-gold-bright underline"
              onClick={() => env.openLink("https://wiseoldman.net/groups/create")}
            >
              Create one on wiseoldman.net
            </button>{" "}
            first — it drives your member list.
          </p>
          <button
            type="button"
            onClick={onLookupWom}
            disabled={womLoading || !womInput.trim()}
            className={primaryBtn}
          >
            {womLoading ? "Looking up…" : "Look up"}
          </button>
          {wom && !wom.already_registered && (
            <p className="text-osrs-green text-sm">
              Found <strong>{wom.name}</strong> · {wom.member_count} members ✓
            </p>
          )}
          <div className="flex justify-between">
            <button type="button" className={ghostBtn} onClick={() => gotoStep(0)}>
              ← Back
            </button>
            <button
              type="button"
              className={primaryBtn}
              disabled={!womReady}
              onClick={() => gotoStep(2)}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Identity (creates the group) ───────────────────────── */}
      {step.key === "identity" && (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Group name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              className={field}
            />
            <span className="text-osrs-parchment-dark/50 mt-1 block text-xs">
              {name.trim().length}/30 characters
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Discord invite URL (optional)</span>
            <input
              value={discordUrl}
              onChange={(e) => setDiscordUrl(e.target.value)}
              placeholder="https://discord.gg/…"
              className={field}
            />
          </label>
          <div className="border-osrs-bronze/40 bg-osrs-brown-dark/40 rounded border p-3 text-sm">
            <p>
              Creating <strong>{name.trim() || "your group"}</strong> for{" "}
              <strong>{guildDisplayName ?? "your server"}</strong>, linked to WOM group{" "}
              <strong>{wom?.name ?? "—"}</strong> ({wom?.member_count ?? 0} members).
            </p>
            <p className="text-osrs-parchment-dark/60 mt-1 text-xs">
              We&apos;ll start syncing your member list right away.
            </p>
          </div>
          <div className="flex justify-between">
            <button type="button" className={ghostBtn} onClick={() => gotoStep(1)}>
              ← Back
            </button>
            <button
              type="button"
              className={primaryBtn}
              disabled={creating || !identityReady || !womReady || !serverReady}
              onClick={onCreate}
            >
              {creating ? "Creating…" : "Create group & continue"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Channels ───────────────────────────────────────────── */}
      {step.key === "channels" && (
        <div className="space-y-4">
          {!channelsLoaded && (
            <p className="text-osrs-parchment-dark/60 text-sm">Loading your server&apos;s channels…</p>
          )}
          {channelsLoaded && (
            <>
              <div>
                <span className="mb-1 block text-sm font-medium">Lootboard channel</span>
                <DiscordChannelPicker
                  channels={channels}
                  value={lootboardChannel}
                  onChange={setLootboardChannel}
                  placeholder="Where the lootboard image posts"
                />
              </div>
              <div>
                <span className="mb-1 block text-sm font-medium">Drop notifications channel</span>
                <DiscordChannelPicker
                  channels={channels}
                  value={dropsChannel}
                  onChange={setDropsChannel}
                  placeholder="Where drop embeds post"
                />
              </div>
              {!channelsCached && <ChannelListDelayHint />}
            </>
          )}
          <div className="flex justify-between">
            <button type="button" className={ghostBtn} onClick={() => gotoStep(4)}>
              Skip for now
            </button>
            <button
              type="button"
              className={primaryBtn}
              disabled={savingChannels || !channelsLoaded}
              onClick={onSaveChannels}
            >
              {savingChannels ? "Saving…" : "Save & continue"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 5: Finish ─────────────────────────────────────────────── */}
      {step.key === "finish" && createdGroupId != null && (
        <div className="space-y-4">
          <Alert variant="success">
            <span>
              <strong>{name.trim() || "Your group"}</strong> is live on DropTracker!
            </span>
          </Alert>
          <ul className="space-y-2 text-sm">
            <li>
              ✅ Members install the{" "}
              <button
                type="button"
                className="text-osrs-gold-bright underline"
                onClick={() => env.openLink(PLUGIN_URL)}
              >
                DropTracker RuneLite plugin
              </button>{" "}
              — that&apos;s where the loot comes from.
            </li>
            <li>
              ✅ Members claim their RSNs (on the website dashboard or with{" "}
              <code>/claim-rsn</code> in your server) so drops link to their Discord.
            </li>
            <li>
              ✅ Fine-tune notifications, minimum values, and more in{" "}
              <button
                type="button"
                className="text-osrs-gold-bright underline"
                onClick={() => env.goToGroup(createdGroupId, { admin: true })}
              >
                group settings
              </button>
              .
            </li>
            <li>
              ✅ Read the{" "}
              <button
                type="button"
                className="text-osrs-gold-bright underline"
                onClick={() => env.openLink(DOCS_URL)}
              >
                docs
              </button>{" "}
              for events, points, and everything else.
            </li>
          </ul>
          {env.surface === "activity" && (
            <p className="text-osrs-parchment-dark/60 text-xs">
              Tip: relaunch the Activity to see your new clan everywhere in the app.
            </p>
          )}
          <button
            type="button"
            className={primaryBtn}
            onClick={() => env.goToGroup(createdGroupId)}
          >
            Go to your group
          </button>
        </div>
      )}
    </div>
  );
}
