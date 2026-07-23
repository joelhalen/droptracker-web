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
              <div className="flex flex-wrap gap-1.5">
                {sources.map((src) => {
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
              {npcs.length === 0 && (
                <p className="mt-1 text-[11px] text-amber-500/80">
                  No sources selected — this item counts from any source.
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
