"use client";

/**
 * The gear and inventory a personal best was set with, drawn the way the game
 * draws them: a 4x7 inventory grid and the equipment silhouette.
 *
 * Fetched on expand rather than with the page — most PB entries are never
 * opened, and pre-fetching every loadout on a profile with 90 personal bests
 * would be dozens of reads nobody looks at.
 */
import { useEffect, useState } from "react";
import type { LoadoutEntry, PersonalBestLoadout } from "@droptracker/api-types";
import { ItemDbIcon } from "@/components/item-db-icon";
import { EmptyState, Skeleton } from "@/components/ui";
import {
  EQUIPMENT_LAYOUT,
  SLOT,
  TILE_PX,
  slotTileUrl,
  type SlotName,
} from "@/lib/equipment";

/** Inventory is 28 slots as a 4-wide grid, exactly as in game. */
const INVENTORY_SLOTS = 28;
const INVENTORY_COLUMNS = 4;

// The silhouette itself lives in lib/ and is unit-tested — it is pure data, and
// getting it subtly wrong is invisible on screen. See lib/equipment.ts.


function formatQuantity(quantity: number): string {
  // The game's stack colouring: k above 100,000 and M above 10,000,000.
  if (quantity >= 10_000_000) return `${Math.floor(quantity / 1_000_000)}M`;
  if (quantity >= 100_000) return `${Math.floor(quantity / 1_000)}K`;
  return String(quantity);
}

function quantityTone(quantity: number): string {
  if (quantity >= 10_000_000) return "text-emerald-400";
  if (quantity >= 100_000) return "text-white";
  return "text-osrs-gold-bright";
}

/** The stack size, drawn over the sprite's top-left the way the game does. */
function Quantity({ quantity }: { quantity: number }) {
  if (quantity <= 1) return null;
  return (
    <span
      className={`pointer-events-none absolute top-0 left-0.5 font-mono text-[10px] leading-none ${quantityTone(quantity)}`}
      style={{ textShadow: "1px 1px 0 #000" }}
    >
      {formatQuantity(quantity)}
    </span>
  );
}

function itemTitle(entry: LoadoutEntry): string {
  return `${entry.name}${entry.quantity > 1 ? ` x${entry.quantity.toLocaleString()}` : ""}`;
}

/**
 * One worn-equipment slot, drawn as the game draws it: the stone tile, with the
 * slot's own faint glyph when empty and the item sprite over a plain tile when
 * filled. The tile is a background image rather than a CSS box so it is the
 * actual interface sprite, not an approximation of it.
 */
function EquipmentSlot({ name, entry }: { name: SlotName; entry?: LoadoutEntry }) {
  return (
    <div
      className="relative"
      style={{
        width: TILE_PX,
        height: TILE_PX,
        backgroundImage: `url(${slotTileUrl(name, Boolean(entry))})`,
        backgroundSize: "100% 100%",
        // The tiles are 36px pixel art; never let the browser smooth them.
        imageRendering: "pixelated",
      }}
      title={entry ? itemTitle(entry) : `${name} slot (empty)`}
    >
      {entry && (
        <span className="absolute inset-0 flex items-center justify-center">
          <ItemDbIcon itemId={entry.item_id} size={32} />
        </span>
      )}
      {entry && <Quantity quantity={entry.quantity} />}
    </div>
  );
}

/** An inventory cell — a plain recessed square, since the game draws no tile here. */
function InventorySlot({ entry }: { entry?: LoadoutEntry }) {
  if (!entry) {
    return (
      <div
        className="border-osrs-bronze/15 rounded-sm border bg-black/20"
        style={{ width: TILE_PX, height: TILE_PX }}
        aria-hidden
      />
    );
  }
  return (
    <div
      className="border-osrs-bronze/25 relative flex items-center justify-center rounded-sm border bg-black/30"
      style={{ width: TILE_PX, height: TILE_PX }}
      title={itemTitle(entry)}
    >
      <ItemDbIcon itemId={entry.item_id} size={32} />
      <Quantity quantity={entry.quantity} />
    </div>
  );
}

function bySlot(entries: LoadoutEntry[]): Map<number, LoadoutEntry> {
  return new Map(entries.map((e) => [e.slot, e]));
}

function EquipmentPanel({ entries }: { entries: LoadoutEntry[] }) {
  const slots = bySlot(entries);
  return (
    <div
      className="border-osrs-bronze/20 inline-grid grid-cols-3 gap-1 rounded-sm border bg-black/25 p-2"
      // Fixed columns: the panel is pixel art at a fixed size, so letting the
      // grid stretch would blur the tiles.
      style={{ gridTemplateColumns: `repeat(3, ${TILE_PX}px)` }}
    >
      {EQUIPMENT_LAYOUT.flat().map((name, i) =>
        name === null ? (
          <div key={`gap-${i}`} style={{ width: TILE_PX, height: TILE_PX }} aria-hidden />
        ) : (
          <EquipmentSlot key={name} name={name} entry={slots.get(SLOT[name])} />
        ),
      )}
    </div>
  );
}

function InventoryPanel({ entries }: { entries: LoadoutEntry[] }) {
  const slots = bySlot(entries);
  return (
    <div
      className="border-osrs-bronze/20 inline-grid gap-1 rounded-sm border bg-black/25 p-2"
      style={{ gridTemplateColumns: `repeat(${INVENTORY_COLUMNS}, ${TILE_PX}px)` }}
    >
      {Array.from({ length: INVENTORY_SLOTS }, (_, i) => (
        <InventorySlot key={i} entry={slots.get(i)} />
      ))}
    </div>
  );
}

export function PbLoadout({ pbId }: { pbId: number }) {
  const [data, setData] = useState<PersonalBestLoadout | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetch(`/api/personal-bests/${pbId}/loadout`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: PersonalBestLoadout) => {
        if (cancelled) return;
        setData(json);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [pbId]);

  if (state === "loading") {
    return <Skeleton className="h-40 w-full" />;
  }
  if (state === "error") {
    return <EmptyState title="Could not load the gear for this time." />;
  }
  if (!data?.has_loadout) {
    return (
      <EmptyState
        title="No gear recorded"
        // Worth explaining: most existing personal bests predate the feature,
        // so an empty panel is expected rather than a fault.
        hint="Gear is captured when a personal best is set, so times set before this feature — or by players who opted out — have none."
      />
    );
  }

  return (
    <div className="flex flex-wrap gap-6">
      <div>
        <h4 className="text-osrs-parchment-dark/60 mb-2 text-xs tracking-wide uppercase">Worn</h4>
        <EquipmentPanel entries={data.equipment} />
      </div>
      <div>
        <h4 className="text-osrs-parchment-dark/60 mb-2 text-xs tracking-wide uppercase">Inventory</h4>
        <InventoryPanel entries={data.inventory} />
      </div>
    </div>
  );
}
