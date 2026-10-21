"use client";

/**
 * Searchable pet picker, grouped by category, with select-all/clear per group.
 *
 * Shared by the points page (which duplicates pay) and the group settings
 * page (which duplicates are announced). Works on lowercased pet names so a
 * saved spelling that differs only in case still shows as picked.
 */

import { useMemo, useState } from "react";
import type { EventPetCategory } from "@droptracker/api-types";
import { PET_CATEGORY_LABELS } from "@/lib/events";
import { Alert } from "@/components/ui";
import { ItemDbIcon } from "@/components/item-db-icon";

const field =
  "bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-osrs-gold/60";

/** Picker order. A pet shows once, under the first group it belongs to, so
 * the raids pets sit under Raids rather than repeating under Bosses. */
const CATEGORY_ORDER = ["raids", "boss", "skilling", "minigame", "clue", "misc"];

export type PetEntry = { name: string; id: number | null };

export function groupPetCatalog(catalog: EventPetCategory[]): { key: string; pets: PetEntry[] }[] {
  const byKey = new Map(catalog.map((c) => [c.key, c.pets]));
  const keys = [...CATEGORY_ORDER, ...catalog.map((c) => c.key).filter((k) => !CATEGORY_ORDER.includes(k))];
  const seen = new Set<string>();
  const out: { key: string; pets: PetEntry[] }[] = [];
  for (const key of keys) {
    const pets = (byKey.get(key) ?? []).filter((p) => {
      const k = p.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (pets.length) out.push({ key, pets });
  }
  return out;
}

export function PetPicker({
  catalog,
  chosen,
  onChange,
  disabled = false,
  summary,
}: {
  /** null while loading; [] when it failed to load. */
  catalog: EventPetCategory[] | null;
  /** Lowercased pet names. */
  chosen: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
  /** The count line, e.g. "3 of 70 pets pay on duplicates". */
  summary: (picked: number, total: number | null) => string;
}) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupPetCatalog(catalog ?? []), [catalog]);
  const total = useMemo(() => groups.reduce((n, g) => n + g.pets.length, 0), [groups]);
  const needle = query.trim().toLowerCase();

  const toggle = (name: string) => {
    const next = new Set(chosen);
    const k = name.toLowerCase();
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onChange(next);
  };

  const setMany = (pets: PetEntry[], on: boolean) => {
    const next = new Set(chosen);
    for (const p of pets) {
      if (on) next.add(p.name.toLowerCase());
      else next.delete(p.name.toLowerCase());
    }
    onChange(next);
  };

  return (
    <div className="border-osrs-bronze/25 space-y-3 rounded border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pets…"
          aria-label="Search pets"
          className={`${field} w-full sm:w-64`}
        />
        <span className="text-osrs-parchment-dark/70 text-xs">
          {summary(chosen.size, total || null)}
        </span>
      </div>
      {catalog === null ? (
        <p className="text-osrs-parchment-dark/60 text-xs">Loading pets…</p>
      ) : groups.length === 0 ? (
        <Alert variant="error">Couldn&apos;t load the pet list. Please refresh.</Alert>
      ) : (
        groups.map((g) => {
          const shown = needle ? g.pets.filter((p) => p.name.toLowerCase().includes(needle)) : g.pets;
          if (!shown.length) return null;
          const picked = g.pets.filter((p) => chosen.has(p.name.toLowerCase())).length;
          return (
            <div key={g.key} className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-osrs-gold/90 text-xs font-semibold uppercase">
                  {PET_CATEGORY_LABELS[g.key] ?? g.key}
                </span>
                <span className="text-osrs-parchment-dark/50 text-xs">
                  {picked}/{g.pets.length}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setMany(g.pets, true)}
                  className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-xs underline-offset-2 hover:underline"
                >
                  Select all
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setMany(g.pets, false)}
                  className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-xs underline-offset-2 hover:underline"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {shown.map((p) => {
                  const on = chosen.has(p.name.toLowerCase());
                  return (
                    <button
                      key={p.name}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(p.name)}
                      aria-pressed={on}
                      className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${
                        on
                          ? "border-osrs-gold/70 bg-osrs-gold/15 text-osrs-parchment"
                          : "border-osrs-bronze/25 text-osrs-parchment-dark/70 hover:border-osrs-bronze/60"
                      } disabled:opacity-50`}
                    >
                      <ItemDbIcon itemId={p.id} size={18} gray={!on} />
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
