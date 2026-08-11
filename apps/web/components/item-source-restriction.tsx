"use client";

/**
 * Per-item "restrict to specific NPC sources" control for the event task
 * builder. Item tasks match a drop by item name from ANY source by default;
 * toggling this on requires the item to have dropped from one of the chosen
 * NPCs (a collection-log unlock never satisfies a source-restricted item).
 *
 * Selection is opt-in and additive: turning the control on starts EMPTY and
 * you add the NPCs you want — either from the item's ingested OSRS Wiki drop
 * sources (`fetchSources`) or, via the search box, from any monster in the
 * database (`searchNpcs`) even if the wiki table doesn't list it. Removing
 * every NPC (or turning the control off) reverts to "any source".
 *
 * "Select all sources" freezes today's wiki source list into the selection;
 * that is deliberately different from leaving the selection empty, which stays
 * dynamically unrestricted (counts any source, including ones added later).
 *
 * Both fetches go through TanStack Query (keyed by item name / search term), so
 * caching, in-flight dedupe and stale-response handling are declarative — the
 * component holds no loading/error/seq bookkeeping of its own.
 */

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { EventItemSourceNpc, EventMetaEntry } from "@droptracker/api-types";
import { formatRarity } from "@/lib/format";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const IMG_BASE = "https://www.droptracker.io/img";

/** The real recorded NPC names a source chip stands for — a merged display
 * alias ("Wintertodt") carries its reward containers in `members`, and the
 * restriction must store those (the engine matches drops by recorded name). */
const chipNames = (src: EventItemSourceNpc): string[] =>
  src.members?.length ? src.members : [src.name];

export function ItemSourceRestriction({
  itemName,
  npcs,
  onChange,
  fetchSources,
  searchNpcs,
  disabled = false,
}: {
  itemName: string;
  /** Currently-allowed source NPCs (empty = unrestricted). */
  npcs: string[];
  onChange: (npcs: string[]) => void;
  /** Batch item-name → source NPCs (bound to the group). */
  fetchSources: (itemName: string) => Promise<EventItemSourceNpc[]>;
  /** NPC-name autocomplete for adding sources the wiki table doesn't list. */
  searchNpcs: (q: string) => Promise<EventMetaEntry[]>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(npcs.length > 0);
  const [query, setQuery] = useState("");
  // Raw `query` drives the instant local filter; the debounced copy drives the
  // network search so a keystroke burst is one request.
  const debouncedQuery = useDebouncedValue(query.trim(), 250);

  // Drop sources for this item (wiki table + observed). Group-independent, so
  // the item name alone is a safe cache key.
  const sourcesQuery = useQuery({
    queryKey: ["item-sources", itemName],
    queryFn: () => fetchSources(itemName),
    enabled: open,
  });
  const sources = sourcesQuery.data ?? [];

  // Off-list monster search — any NPC, not just the item's wiki sources.
  const searchQuery = useQuery({
    queryKey: ["npc-search", debouncedQuery],
    queryFn: () => searchNpcs(debouncedQuery),
    enabled: open && debouncedQuery.length >= 2,
    placeholderData: keepPreviousData, // keep the last hits visible while retyping
  });

  const allowed = new Set(npcs.map((n) => n.toLowerCase()));
  const chipOn = (src: EventItemSourceNpc) =>
    chipNames(src).some((n) => allowed.has(n.toLowerCase()));
  const toggle = (src: EventItemSourceNpc) => {
    const keys = new Set(chipNames(src).map((n) => n.toLowerCase()));
    if (chipOn(src)) onChange(npcs.filter((n) => !keys.has(n.toLowerCase())));
    else onChange([...npcs, ...chipNames(src).filter((n) => !allowed.has(n.toLowerCase()))]);
  };
  const addName = (name: string) => {
    if (!allowed.has(name.toLowerCase())) onChange([...npcs, name]);
  };
  const removeName = (name: string) =>
    onChange(npcs.filter((n) => n.toLowerCase() !== name.toLowerCase()));
  const selectAll = () => {
    if (!sources.length) return;
    const seen = new Set(allowed);
    const merged = [...npcs];
    for (const n of sources.flatMap(chipNames)) {
      if (!seen.has(n.toLowerCase())) {
        seen.add(n.toLowerCase());
        merged.push(n);
      }
    }
    onChange(merged);
  };

  const q = query.trim().toLowerCase();
  const filteredSources = sources.filter(
    (src) =>
      !q ||
      src.name.toLowerCase().includes(q) ||
      chipNames(src).some((n) => n.toLowerCase().includes(q)),
  );
  // Off-list matches: search hits the loaded catalog doesn't already cover.
  const catalogNames = new Set(
    sources.flatMap((src) => [src.name.toLowerCase(), ...chipNames(src).map((n) => n.toLowerCase())]),
  );
  const offList = (searchQuery.data ?? []).filter((r) => !catalogNames.has(r.name.toLowerCase()));

  return (
    <div className="border-osrs-bronze/20 bg-osrs-brown-dark/30 mt-1.5 rounded border p-2">
      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={open}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.checked) setOpen(true);
            else {
              setOpen(false);
              onChange([]); // off = any source
            }
          }}
          className="accent-osrs-gold"
        />
        <span className="text-osrs-parchment-dark/80">Only count drops from specific NPCs</span>
        {open && npcs.length > 0 && (
          <span className="text-osrs-gold-bright ml-auto shrink-0">{npcs.length} selected</span>
        )}
      </label>

      {open && (
        <div className="mt-2">
          {/* Selected NPCs — removable chips, incl. off-list ones the catalog
              below never shows. */}
          {npcs.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {npcs.map((name) => (
                <button
                  type="button"
                  key={name}
                  onClick={() => removeName(name)}
                  disabled={disabled}
                  title="Remove"
                  className="border-osrs-gold bg-osrs-gold/15 text-osrs-gold-bright flex items-center gap-1.5 rounded border px-2 py-1 text-xs"
                >
                  <span>{name}</span>
                  <span aria-hidden className="text-osrs-parchment-dark/70">
                    ×
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mb-2 text-[11px] text-amber-500/80">
              No NPCs selected — this item counts drops from any source. Add the ones that should count.
            </p>
          )}

          {/* Search + bulk affordances. */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={query}
              disabled={disabled}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search drop sources or any monster…"
              className="border-osrs-bronze/40 bg-osrs-brown-dark/40 text-osrs-parchment-dark placeholder:text-osrs-parchment-dark/40 min-w-0 flex-1 rounded border px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={selectAll}
              disabled={disabled || !sources.length}
              className="border-osrs-bronze/40 text-osrs-parchment-dark/70 hover:border-osrs-gold shrink-0 rounded border px-2 py-1 text-xs disabled:opacity-40"
            >
              Select all
            </button>
            {npcs.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                disabled={disabled}
                className="border-osrs-bronze/40 text-osrs-parchment-dark/70 hover:border-osrs-red shrink-0 rounded border px-2 py-1 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Drop-source catalog (add from). */}
          <div className="mt-2">
            {sourcesQuery.isLoading ? (
              <p className="text-osrs-parchment-dark/50 text-xs">Loading drop sources…</p>
            ) : sourcesQuery.isError ? (
              <p className="text-osrs-red/80 text-xs">Couldn&apos;t load drop sources — try again.</p>
            ) : sources.length ? (
              <div className="flex flex-wrap gap-1.5">
                {filteredSources.map((src) => {
                  const on = chipOn(src);
                  return (
                    <button
                      type="button"
                      key={src.npc_id}
                      onClick={() => toggle(src)}
                      aria-pressed={on}
                      disabled={disabled}
                      title={`${src.name} · ${formatRarity(src.rarity)}${
                        src.tracked ? "" : " · never seen in tracked drops"
                      }`}
                      className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${
                        on
                          ? "border-osrs-gold bg-osrs-gold/15 text-osrs-gold-bright"
                          : "border-osrs-bronze/40 text-osrs-parchment-dark/70 hover:border-osrs-gold"
                      }`}
                    >
                      <img
                        src={`${IMG_BASE}/npcdb/${src.npc_id}.png`}
                        alt=""
                        width={16}
                        height={16}
                        className="inline-block shrink-0 object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                        }}
                      />
                      <span aria-hidden className="text-osrs-parchment-dark/50">
                        {on ? "✓" : "+"}
                      </span>
                      <span>{src.name}</span>
                      {!src.tracked && (
                        <span className="text-amber-500" title="Never seen in tracked drops">
                          ⚠
                        </span>
                      )}
                    </button>
                  );
                })}
                {filteredSources.length === 0 && (
                  <p className="text-osrs-parchment-dark/50 text-xs">
                    No matching drop sources{q ? " — try the monster search below" : ""}.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-osrs-parchment-dark/50 text-xs">
                No known drop sources for this item — search below to add any monster.
              </p>
            )}
          </div>

          {/* Off-list monster search results. */}
          {query.trim().length >= 2 && (
            <div className="mt-2">
              <p className="text-osrs-parchment-dark/50 mb-1 text-[11px] uppercase tracking-wide">
                Other monsters
              </p>
              {searchQuery.isFetching || query.trim() !== debouncedQuery ? (
                <p className="text-osrs-parchment-dark/50 text-xs">Searching…</p>
              ) : offList.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {offList.map((r) => {
                    const on = allowed.has(r.name.toLowerCase());
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => (on ? removeName(r.name) : addName(r.name))}
                        aria-pressed={on}
                        disabled={disabled}
                        title={r.tracked === false ? `${r.name} · never seen in tracked drops` : r.name}
                        className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${
                          on
                            ? "border-osrs-gold bg-osrs-gold/15 text-osrs-gold-bright"
                            : "border-osrs-bronze/40 text-osrs-parchment-dark/70 hover:border-osrs-gold"
                        }`}
                      >
                        <img
                          src={`${IMG_BASE}/npcdb/${r.id}.png`}
                          alt=""
                          width={16}
                          height={16}
                          className="inline-block shrink-0 object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                          }}
                        />
                        <span aria-hidden className="text-osrs-parchment-dark/50">
                          {on ? "✓" : "+"}
                        </span>
                        <span>{r.name}</span>
                        {r.tracked === false && (
                          <span className="text-amber-500" title="Never seen in tracked drops">
                            ⚠
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-osrs-parchment-dark/50 text-xs">No other monsters found.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
