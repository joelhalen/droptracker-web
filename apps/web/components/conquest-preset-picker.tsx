"use client";

/**
 * The preset panel's region and tile picker (Conquest designer).
 *
 * Every region of the ready-made map, with its tiles. Anything left out is
 * redrawn away on the server (disc services/conquest_mapgen): a removed
 * region's land goes to the kept regions on its landmass, an island with
 * nothing kept disappears and the map is cropped to what's left; a region's
 * remaining tiles share out the ground of the ones left out. Tiles this server
 * can't price yet are shown but can't be picked.
 */
import { useEffect, useRef } from "react";
import type { ConquestPresetRegion, ConquestPresetTile } from "@droptracker/api-types";
import { REGION_COLORS, presetAvailableTiles, presetSelectionText } from "@/lib/conquest";

function tileIcon(tile: ConquestPresetTile): string | null {
  if (tile.icon_item_id) return `/img/itemdb/${tile.icon_item_id}.png`;
  if (tile.icon_npc_id) return `/img/npcdb/${tile.icon_npc_id}.png`;
  return null;
}

/** A checkbox that can show "some of these" (the DOM-only indeterminate). */
function RegionCheckbox({
  checked,
  mixed,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  mixed: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="accent-osrs-gold h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

export function ConquestPresetPicker({
  regions,
  picked,
  onChange,
}: {
  regions: ConquestPresetRegion[];
  picked: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}) {
  const setMany = (keys: string[], on: boolean) => {
    const next = new Set(picked);
    for (const k of keys) {
      if (on) next.add(k);
      else next.delete(k);
    }
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-osrs-parchment font-semibold">
          {presetSelectionText(regions, picked)}
        </span>
        <button
          type="button"
          className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright underline-offset-2 hover:underline"
          onClick={() => onChange(presetAvailableTiles(regions))}
        >
          Pick everything
        </button>
        <button
          type="button"
          className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright underline-offset-2 hover:underline"
          onClick={() => onChange(new Set())}
        >
          Clear
        </button>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {regions.map((r, i) => {
          const color = r.color ?? REGION_COLORS[i % REGION_COLORS.length]!;
          const available = r.tiles.filter((t) => t.available).map((t) => t.key);
          const on = available.filter((k) => picked.has(k)).length;
          return (
            <div
              key={r.key}
              className={`rounded border p-2 transition-opacity ${on ? "" : "opacity-60"}`}
              style={{ borderColor: `${color}80` }}
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RegionCheckbox
                  checked={on > 0 && on === available.length}
                  mixed={on > 0 && on < available.length}
                  disabled={!available.length}
                  label={`Include ${r.name}`}
                  onChange={(v) => setMany(available, v)}
                />
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: color }}
                  aria-hidden
                />
                <span className="text-osrs-parchment min-w-0 truncate font-semibold">{r.name}</span>
                <span className="text-osrs-parchment-dark/60 ml-auto shrink-0 text-xs tabular-nums">
                  {on}/{r.tiles.length}
                </span>
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.tiles.map((t) => {
                  const active = picked.has(t.key);
                  const icon = tileIcon(t);
                  return (
                    <button
                      key={t.key}
                      type="button"
                      aria-pressed={active}
                      disabled={!t.available}
                      title={t.available ? undefined : "This server can't build this tile yet."}
                      onClick={() => setMany([t.key], !active)}
                      className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        active
                          ? "border-osrs-gold/60 bg-osrs-gold/15 text-osrs-parchment"
                          : "border-osrs-bronze/30 text-osrs-parchment-dark/60 hover:border-osrs-bronze/60 line-through decoration-1"
                      }`}
                    >
                      {icon && (
                        <img src={icon} alt="" className="h-4 w-4 object-contain" loading="lazy" />
                      )}
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-osrs-parchment-dark/50 text-xs">
        Untick a region or tile to leave it out and the map is redrawn without it: neighbouring
        regions take over the land, islands with nothing left on them disappear, and the map is
        cropped to fit. Redrawing takes about half a minute.
      </p>
    </div>
  );
}
