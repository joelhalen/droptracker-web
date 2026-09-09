"use client";

/**
 * Per-item "restrict to specific NPC sources" control for the event task
 * builder. Item tasks match a drop by item name from ANY source by default;
 * toggling this on requires the item to have dropped from one of the chosen
 * NPCs (a collection-log unlock never satisfies a source-restricted item).
 *
 * Sources come from the ingested OSRS Wiki drop table (`fetchSources`). The
 * restriction is opt-in: closed = any source. Turning it on pre-selects every
 * known source so the configurator prunes down; removing every chip (or turning
 * it off) reverts to any source.
 *
 * Items with hundreds of sources (a Scroll box drops from 150+ NPCs) get bulk
 * "Select all" / "Deselect all" buttons and a name filter, so "deselect all,
 * then pick the three bosses that count" is three clicks, not 150. The bulk
 * buttons act on the chips currently shown, so a filter narrows them too.
 */

import { useEffect, useRef, useState } from "react";
import type { EventItemSourceNpc } from "@droptracker/api-types";
import { formatRarity } from "@/lib/format";

const IMG_BASE = "https://www.droptracker.io/img";

/** The real recorded NPC names a source chip stands for — a merged display
 * alias ("Wintertodt") carries its reward containers in `members`, and the
 * restriction must store those (the engine matches drops by recorded name). */
const chipNames = (src: EventItemSourceNpc): string[] =>
  src.members?.length ? src.members : [src.name];

/** Below this many sources the chip grid is scannable by eye; the name filter
 * only appears above it (the bulk buttons always show). */
const FILTER_MIN_SOURCES = 8;

const bulkBtnClass =
  "text-osrs-gold-bright/80 hover:text-osrs-gold-bright hover:underline underline-offset-2 disabled:cursor-not-allowed disabled:text-osrs-parchment-dark/30 disabled:no-underline";

export function ItemSourceRestriction({
  itemName,
  npcs,
  onChange,
  fetchSources,
  disabled = false,
}: {
  itemName: string;
  /** Currently-allowed source NPCs (empty = unrestricted). */
  npcs: string[];
  onChange: (npcs: string[]) => void;
  /** Batch item-name → source NPCs (bound to the group). */
  fetchSources: (itemName: string) => Promise<EventItemSourceNpc[]>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(npcs.length > 0);
  const [sources, setSources] = useState<EventItemSourceNpc[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("");
  // Which item name we've fetched for, so re-picking a different item refetches.
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Sources already loaded for this item (e.g. re-ticking after an untick
    // cleared the selection) — re-seed from cache instead of refetching so the
    // "start from all sources" convenience runs every time it's turned on.
    if (fetchedFor.current === itemName && sources !== null) {
      if (npcs.length === 0 && sources.length) onChange(sources.flatMap(chipNames));
      return;
    }
    fetchedFor.current = itemName;
    setFilter("");
    setLoading(true);
    setError(false);
    let cancelled = false;
    fetchSources(itemName)
      .then((rows) => {
        if (cancelled) return;
        setSources(rows);
        // Turning restriction on with no prior selection starts from ALL known
        // sources — the configurator then removes the ones they don't want.
        // Alias chips ("Wintertodt") expand to their real recorded names.
        if (npcs.length === 0 && rows.length) onChange(rows.flatMap(chipNames));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemName]);

  const allowed = new Set(npcs.map((n) => n.toLowerCase()));
  const chipOn = (src: EventItemSourceNpc) =>
    chipNames(src).some((n) => allowed.has(n.toLowerCase()));
  const toggle = (src: EventItemSourceNpc) => {
    const keys = new Set(chipNames(src).map((n) => n.toLowerCase()));
    if (chipOn(src)) onChange(npcs.filter((n) => !keys.has(n.toLowerCase())));
    else onChange([...npcs, ...chipNames(src).filter((n) => !allowed.has(n.toLowerCase()))]);
  };

  // Name filter (matches the chip label or, for an alias chip, any member
  // name) and the bulk actions, which act on the chips currently shown.
  const query = filter.trim().toLowerCase();
  const filtered = query.length > 0;
  const visible =
    sources && filtered
      ? sources.filter(
          (src) =>
            src.name.toLowerCase().includes(query) ||
            (src.members ?? []).some((m) => m.toLowerCase().includes(query)),
        )
      : (sources ?? []);
  const visibleOn = visible.filter(chipOn).length;
  const selectVisible = () => {
    const seen = new Set(allowed);
    const additions: string[] = [];
    for (const name of visible.flatMap(chipNames)) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      additions.push(name);
    }
    if (additions.length) onChange([...npcs, ...additions]);
  };
  const deselectVisible = () => {
    // Unfiltered "Deselect all" clears outright (also drops any stored name
    // that no longer appears as a chip); filtered = only the shown chips.
    if (!filtered) return onChange([]);
    const keys = new Set(visible.flatMap(chipNames).map((n) => n.toLowerCase()));
    onChange(npcs.filter((n) => !keys.has(n.toLowerCase())));
  };

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
              setFilter("");
              onChange([]); // off = any source
            }
          }}
          className="accent-osrs-gold"
        />
        <span className="text-osrs-parchment-dark/80">Only count drops from specific NPCs</span>
        {open && sources && sources.length > 0 && (
          <span className="text-osrs-gold-bright ml-auto shrink-0">
            {sources.filter(chipOn).length}/{sources.length}
          </span>
        )}
      </label>

      {open && (
        <div className="mt-2">
          {loading ? (
            <p className="text-osrs-parchment-dark/50 text-xs">Loading drop sources…</p>
          ) : error ? (
            <p className="text-osrs-red/80 text-xs">Couldn&apos;t load drop sources — try again.</p>
          ) : sources && sources.length ? (
            <>
              <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {sources.length >= FILTER_MIN_SOURCES && (
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter sources…"
                    aria-label="Filter drop sources by name"
                    disabled={disabled}
                    onKeyDown={(e) => {
                      // The control sits inside the task <form>; Enter here
                      // must not submit it.
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    className="bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 focus:ring-osrs-gold/60 min-w-0 flex-1 basis-40 rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1"
                  />
                )}
                <div className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={selectVisible}
                    disabled={disabled || visible.length === 0 || visibleOn === visible.length}
                    className={bulkBtnClass}
                  >
                    {filtered ? "Select shown" : "Select all"}
                  </button>
                  <span className="text-osrs-parchment-dark/30" aria-hidden>
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={deselectVisible}
                    disabled={disabled || (filtered ? visibleOn === 0 : npcs.length === 0)}
                    className={bulkBtnClass}
                  >
                    {filtered ? "Deselect shown" : "Deselect all"}
                  </button>
                </div>
              </div>
              {filtered && visible.length === 0 && (
                <p className="text-osrs-parchment-dark/50 text-xs">
                  No sources match &ldquo;{filter.trim()}&rdquo;.
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {visible.map((src) => {
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
                          : "border-osrs-bronze/40 text-osrs-parchment-dark/60 hover:border-osrs-gold line-through"
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
                      <span>{src.name}</span>
                      {!src.tracked && (
                        <span className="text-amber-500" title="Never seen in tracked drops">
                          ⚠
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {filtered && visible.length > 0 && (
                <p className="text-osrs-parchment-dark/50 mt-1 text-[11px]">
                  Showing {visible.length} of {sources.length} sources.
                </p>
              )}
              {npcs.length === 0 && (
                <p
                  role="alert"
                  className="mt-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-400"
                >
                  ⚠ No sources selected: this restriction is inactive and the item counts from{" "}
                  <strong>any</strong> source. Pick at least one NPC above, or untick the box.
                </p>
              )}
            </>
          ) : (
            <p className="text-osrs-parchment-dark/50 text-xs">
              No known drop sources for this item — it can&apos;t be restricted by NPC.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
