"use client";

/**
 * Multi-select boss picker for the "bosslist" config field
 * (personal_best_embed_boss_list — the Hall of Fame boss list). Options come
 * from `GET /groups/{id}/pb-bosses`: the distinct NPC names with at least one
 * stored personal best, i.e. exactly the names the HoF service can match. This
 * replaces free-text entry so admins can't save misspelled boss names.
 *
 * Always falls back to manual comma-separated entry when the list can't be
 * fetched, and legacy values are preserved: names already saved that don't
 * match a known boss are surfaced as removable "unrecognized" chips rather
 * than silently dropped.
 */
import { useMemo, useState } from "react";
import { fieldInputClass as input } from "@/components/ui";

/** Parse a stored boss list. Tolerates the legacy `["A", "B"]` format the HoF
 * parser also accepts (it strips brackets/quotes), dedupes case-insensitively. */
function parseBossList(value: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of value.replace(/[[\]"]/g, "").split(",")) {
    const name = part.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function BossListPicker({
  bosses,
  value,
  onChange,
  disabled = false,
}: {
  bosses: string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  // `null` = follow list availability automatically (same pattern as
  // DiscordChannelPicker: the prop is empty pre-fetch, so a snapshotting
  // useState initializer would get stuck on manual entry forever).
  const [manualOverride, setManualOverride] = useState<boolean | null>(null);
  const manual = manualOverride ?? bosses.length === 0;

  const selected = useMemo(() => parseBossList(value), [value]);
  const selectedKeys = useMemo(() => new Set(selected.map((s) => s.toLowerCase())), [selected]);
  const bossKeys = useMemo(() => new Set(bosses.map((b) => b.toLowerCase())), [bosses]);
  const unrecognized = selected.filter((s) => !bossKeys.has(s.toLowerCase()));

  const commit = (names: string[]) =>
    onChange(
      [...names]
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .join(", "),
    );

  const toggle = (name: string) => {
    const key = name.toLowerCase();
    if (selectedKeys.has(key)) commit(selected.filter((s) => s.toLowerCase() !== key));
    else commit([...selected, name]);
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? bosses.filter((b) => b.toLowerCase().includes(q)) : bosses;
  }, [bosses, query]);

  if (manual) {
    return (
      <div className="space-y-1">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Comma-separated boss names"
          disabled={disabled}
          className={`${input} w-full disabled:cursor-not-allowed disabled:opacity-60`}
          rows={2}
        />
        {bosses.length > 0 && !disabled && (
          <button
            type="button"
            onClick={() => setManualOverride(false)}
            className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs"
          >
            Pick from the boss list instead
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="border-osrs-bronze/20 bg-osrs-surface-2/40 rounded-lg border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-osrs-parchment-dark/70 text-xs">
          {selected.length === 0 ? "No bosses selected" : `${selected.length} selected`}
        </span>
        {selected.length > 0 && !disabled && (
          <button
            type="button"
            onClick={() => commit([])}
            className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs"
          >
            Clear all
          </button>
        )}
        {!disabled && (
          <button
            type="button"
            onClick={() => setManualOverride(true)}
            className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright ml-auto text-xs"
          >
            Edit as text
          </button>
        )}
      </div>

      {unrecognized.length > 0 && (
        <div className="border-osrs-bronze/20 mb-2 border-b pb-2">
          <p className="text-osrs-gold-bright mb-1 text-xs">
            Not matching any boss with recorded personal bests (possible typos — the Hall of Fame
            will ignore them):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unrecognized.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => toggle(name)}
                title="Remove"
                className="border-osrs-bronze/30 bg-osrs-surface-2 hover:border-osrs-gold/50 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
              >
                {name}
                <span aria-hidden="true" className="text-osrs-parchment-dark/60">
                  ×
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search bosses…"
        disabled={disabled}
        className={`${input} mb-2 w-full disabled:cursor-not-allowed disabled:opacity-60`}
      />

      <ul className="grid max-h-64 gap-x-4 overflow-y-auto sm:grid-cols-2">
        {matches.length === 0 ? (
          <li className="text-osrs-parchment-dark/60 py-1 text-sm sm:col-span-2">
            No matching bosses.
          </li>
        ) : (
          matches.map((name) => {
            const checked = selectedKeys.has(name.toLowerCase());
            return (
              <li key={name}>
                <label className="hover:bg-osrs-bronze/10 flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(name)}
                    disabled={disabled}
                    className="accent-osrs-gold shrink-0 disabled:cursor-not-allowed"
                  />
                  <span className={checked ? "" : "text-osrs-parchment-dark/80"}>{name}</span>
                </label>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
