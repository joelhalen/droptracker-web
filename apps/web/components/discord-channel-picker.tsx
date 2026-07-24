"use client";

/**
 * Search-filterable Discord channel picker for "channel" config fields
 * (channel_id_to_post_loot, lootboard_channel_id, etc.). Channels come from the bot's
 * Redis cache (`GET /groups/{id}/discord-channels`) — the Web API never talks
 * to Discord directly. Always falls back to manual numeric-id entry: the cache
 * can be empty (bot never ran there yet, guild not linked) or stale (bot down),
 * and a group admin must never be blocked from setting a channel because of it.
 *
 * Thread-aware (suggestion #3): the cache also carries forum channels and
 * their active threads, so a group can route each notification type into a
 * thread of e.g. one "achievements" forum instead of separate channels.
 * Threads render as "#forum › thread" and are selectable like any channel
 * (the bot's send path is identical); bare forum channels are shown only as
 * thread prefixes — nothing can post to a forum itself.
 */
import { useMemo, useState } from "react";
import type { DiscordChannel } from "@/lib/api";
import { fieldInputClass as input } from "@/components/ui";

function channelLabel(c: DiscordChannel, byId: Map<string, DiscordChannel>): string {
  if (c.type === "thread") {
    const parent = c.parent_id ? byId.get(c.parent_id) : undefined;
    return parent ? `#${parent.name} › ${c.name}` : `#${c.name}`;
  }
  return `#${c.name}`;
}

export function DiscordChannelPicker({
  channels,
  value,
  onChange,
  placeholder = "Discord channel id",
  disabled = false,
  mode = "sendable",
}: {
  channels: DiscordChannel[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** "sendable" (default): text channels + threads — forums AND categories
   * excluded, they aren't messageable. "forum": ONLY forum channels, flat
   * list — the per-team thread parent. "category": ONLY channel categories,
   * flat list — the parent for per-team private channels. */
  mode?: "sendable" | "forum" | "category";
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // `null` = no explicit user choice yet — follow channel-list availability
  // automatically. Storing `manual` as its own useState(channels.length === 0)
  // would snapshot the *initial* (always-empty, pre-fetch) channels prop and
  // never revisit it once the real list arrives, since useState's initializer
  // only runs on mount — permanently stuck on manual entry for every group.
  const [manualOverride, setManualOverride] = useState<boolean | null>(null);

  const byId = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);
  // Sendable mode: forums and categories are not messageable — forums exist
  // in the list only to prefix their threads' labels, categories not at all,
  // so neither appears as an option. Forum/category modes invert that: only
  // that container type is listed (no thread rows).
  const selectable = useMemo(
    () =>
      mode === "forum"
        ? channels.filter((c) => c.type === "forum")
        : mode === "category"
          ? channels.filter((c) => c.type === "category")
          : channels.filter((c) => c.type !== "forum" && c.type !== "category"),
    [channels, mode],
  );
  const manual = manualOverride ?? selectable.length === 0;

  const selected = useMemo(() => selectable.find((c) => c.id === value), [selectable, value]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    // No arbitrary cap: the list is scrollable, and capping it hid every
    // channel past the first N in big guilds — including all forum threads,
    // which sort with their parent forum's position.
    return q ? selectable.filter((c) => channelLabel(c, byId).toLowerCase().includes(q)) : selectable;
  }, [selectable, byId, query]);

  if (manual || selectable.length === 0) {
    return (
      <div className="space-y-1">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`${input} w-full disabled:cursor-not-allowed disabled:opacity-60`}
        />
        {selectable.length > 0 && !disabled && (
          <button
            type="button"
            onClick={() => setManualOverride(false)}
            className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs"
          >
            Choose from channel list instead
          </button>
        )}
      </div>
    );
  }

  const displayValue = open
    ? query
    : selected
      ? channelLabel(selected, byId)
      : value
        ? `Unknown channel (${value})`
        : "";

  return (
    <div className="relative">
      <input
        type="text"
        value={displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={
          mode === "forum"
            ? "Search forum channels…"
            : mode === "category"
              ? "Search categories…"
              : "Search channels…"
        }
        disabled={disabled}
        className={`${input} w-full disabled:cursor-not-allowed disabled:opacity-60`}
      />
      {open && !disabled && (
        <ul className="border-osrs-bronze/30 bg-osrs-brown-dark absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded border text-sm shadow-lg">
          {matches.length === 0 ? (
            <li className="text-osrs-parchment-dark/60 px-3 py-2">No matching channels.</li>
          ) : (
            matches.map((c, i) => {
              // Group headers: when a run of threads starts, name the forum
              // (or text channel) they live in so forums are visibly present
              // in the list even though they aren't selectable themselves.
              const prev = matches[i - 1];
              const startsThreadRun =
                c.type === "thread" && (!prev || prev.type !== "thread" || prev.parent_id !== c.parent_id);
              const parent = c.parent_id ? byId.get(c.parent_id) : undefined;
              return (
                <li key={c.id}>
                  {startsThreadRun && parent && (
                    <div className="text-osrs-gold-bright/80 border-osrs-bronze/20 border-t px-3 pt-2 pb-1 text-xs font-semibold">
                      {parent.type === "forum" ? "Forum" : "Threads in"} #{parent.name}
                    </div>
                  )}
                  <button
                    type="button"
                    // Fire before the input's onBlur closes the list.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(c.id);
                      setOpen(false);
                    }}
                    className={`hover:bg-osrs-bronze/20 flex w-full items-center justify-between gap-2 px-3 py-2 text-left ${
                      c.type === "thread" ? "pl-6" : ""
                    }`}
                  >
                    <span className="truncate">{c.type === "thread" ? c.name : channelLabel(c, byId)}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {c.type === "thread" && (
                        <span className="text-osrs-parchment-dark/50 text-xs">thread</span>
                      )}
                      {c.id === value && <span className="text-osrs-gold-bright text-xs">selected</span>}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setManualOverride(true)}
        disabled={disabled}
        className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright mt-1 text-xs disabled:opacity-50"
      >
        Enter a channel ID manually instead
      </button>
    </div>
  );
}

/**
 * Page-level note for anywhere a DiscordChannelPicker appears: the dropdown is
 * fed by a bot-maintained cache, so brand-new channels/threads lag behind —
 * but a pasted id always works immediately (the backend stores it as-is and
 * the bot resolves it at send time, threads included).
 */
export function ChannelListDelayHint({ className = "" }: { className?: string }) {
  return (
    <p className={`text-osrs-parchment-dark/60 text-xs ${className}`}>
      Just created a channel or thread on Discord? Due to Discord rate limits it can take up to ~5
      minutes to appear in these lists (usually much less — reload the page after a moment). You can
      skip the wait by pasting its ID directly: enable Developer Mode in Discord (Settings →
      Advanced), then right-click the channel or thread → Copy ID. Threads inside forum channels
      work too.
    </p>
  );
}
