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

/** Inventory is 28 slots as a 4-wide grid, exactly as in game. */
const INVENTORY_SLOTS = 28;
const INVENTORY_COLUMNS = 4;

/**
 * Worn equipment slot indices, laid out on the same 3-column silhouette the
 * game uses. `null` is a gap in the layout, not an empty slot.
 *
 * Indices follow the game's worn-items container order: head, cape, amulet,
 * weapon, body, shield, legs, hands, feet, ring, ammo.
 */
const EQUIPMENT_LAYOUT: (number | null)[][] = [
  [null, 0, null],
  [1, 2, 13],
  [null, 4, null],
  [3, 5, 12],
  [null, 7, null],
  [9, 10, 11],
];

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

function Slot({ entry }: { entry?: LoadoutEntry }) {
  if (!entry) {
    return <div className="border-osrs-bronze/20 aspect-square rounded-sm border bg-black/20" aria-hidden />;
  }
  return (
    <div
      className="border-osrs-bronze/30 relative flex aspect-square items-center justify-center rounded-sm border bg-black/30"
      title={`${entry.name}${entry.quantity > 1 ? ` x${entry.quantity.toLocaleString()}` : ""}`}
    >
      <ItemDbIcon itemId={entry.item_id} size={32} />
      {entry.quantity > 1 && (
        <span
          className={`absolute left-0.5 top-0 text-[10px] leading-none font-mono ${quantityTone(entry.quantity)}`}
          style={{ textShadow: "1px 1px 0 #000" }}
        >
          {formatQuantity(entry.quantity)}
        </span>
      )}
    </div>
  );
}

function bySlot(entries: LoadoutEntry[]): Map<number, LoadoutEntry> {
  return new Map(entries.map((e) => [e.slot, e]));
}

function EquipmentPanel({ entries }: { entries: LoadoutEntry[] }) {
  const slots = bySlot(entries);
  return (
    <div className="grid grid-cols-3 gap-1 w-[132px]">
      {EQUIPMENT_LAYOUT.flat().map((slot, i) =>
        slot === null ? (
          <div key={`gap-${i}`} aria-hidden />
        ) : (
          <Slot key={slot} entry={slots.get(slot)} />
        ),
      )}
    </div>
  );
}

function InventoryPanel({ entries }: { entries: LoadoutEntry[] }) {
  const slots = bySlot(entries);
  return (
    <div
      className="grid gap-1 w-[176px]"
      style={{ gridTemplateColumns: `repeat(${INVENTORY_COLUMNS}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: INVENTORY_SLOTS }, (_, i) => (
        <Slot key={i} entry={slots.get(i)} />
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
