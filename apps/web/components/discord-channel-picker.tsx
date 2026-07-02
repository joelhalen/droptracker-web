"use client";

/**
 * Search-filterable Discord channel picker for "channel" config fields
 * (drop_channel_id, lootboard_channel_id, etc.). Channels come from the bot's
 * Redis cache (`GET /groups/{id}/discord-channels`) — the Web API never talks
 * to Discord directly. Always falls back to manual numeric-id entry: the cache
 * can be empty (bot never ran there yet, guild not linked) or stale (bot down),
 * and a group admin must never be blocked from setting a channel because of it.
 */
import { useMemo, useState } from "react";
import type { DiscordChannel } from "@/lib/api";

const input =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-1.5 text-sm outline-none";

export function DiscordChannelPicker({
  channels,
  value,
  onChange,
  placeholder = "Discord channel id",
}: {
  channels: DiscordChannel[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // `null` = no explicit user choice yet — follow channel-list availability
  // automatically. Storing `manual` as its own useState(channels.length === 0)
  // would snapshot the *initial* (always-empty, pre-fetch) channels prop and
  // never revisit it once the real list arrives, since useState's initializer
  // only runs on mount — permanently stuck on manual entry for every group.
  const [manualOverride, setManualOverride] = useState<boolean | null>(null);
  const manual = manualOverride ?? channels.length === 0;

  const selected = useMemo(() => channels.find((c) => c.id === value), [channels, value]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q ? channels.filter((c) => c.name.toLowerCase().includes(q)) : channels;
    return pool.slice(0, 20);
  }, [channels, query]);

  if (manual || channels.length === 0) {
    return (
      <div className="space-y-1">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${input} w-full`}
        />
        {channels.length > 0 && (
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
      ? `#${selected.name}`
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
        placeholder="Search channels…"
        className={`${input} w-full`}
      />
      {open && (
        <ul className="border-osrs-bronze/30 bg-osrs-brown-dark absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded border text-sm shadow-lg">
          {matches.length === 0 ? (
            <li className="text-osrs-parchment-dark/60 px-3 py-2">No matching channels.</li>
          ) : (
            matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  // Fire before the input's onBlur closes the list.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  className="hover:bg-osrs-bronze/20 flex w-full items-center justify-between px-3 py-2 text-left"
                >
                  <span>#{c.name}</span>
                  {c.id === value && <span className="text-osrs-gold-bright text-xs">selected</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setManualOverride(true)}
        className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright mt-1 text-xs"
      >
        Enter a channel ID manually instead
      </button>
    </div>
  );
}
