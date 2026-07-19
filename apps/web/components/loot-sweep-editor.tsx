"use client";

/**
 * Loot Sweep set editor — the authoring side of a `loot_sweep` task (one boss
 * "set"). Each item scores points that decay on every repeat receipt (the
 * preview strip shows the exact sequence, e.g. 9 · 7 · 5 · 4 · 2), capped per
 * item; collecting the whole set awards a bonus. Icon-first so it reads like
 * the boss's drop table rather than a spreadsheet.
 *
 * Controlled: the parent (event-task-form) owns a `LootSweepDraft` and turns it
 * into the task `config` on save via {@link lootSweepToConfig}.
 */

import { useEffect, useRef, useState } from "react";
import type { EventMetaEntry, LootSweepDecayMode } from "@droptracker/api-types";
import { ItemDbIcon } from "@/components/item-db-icon";
import { QuantityInput } from "@/components/quantity-input";
import { decaySequence } from "@/lib/loot-sweep";

export type LootSweepItemDraft = {
  name: string;
  id?: number | null;
  points: number;
  /** Per-item cap override; null = inherit the set default. */
  maxAwards?: number | null;
  countsForSet: boolean;
};

export type LootSweepDraft = {
  items: LootSweepItemDraft[];
  decayPercent: number;
  decayMode: LootSweepDecayMode;
  defaultMax: number;
  setBonusPoints: number;
  setBonusMax: number;
};

export function emptyLootSweepDraft(): LootSweepDraft {
  return {
    items: [],
    decayPercent: 20,
    decayMode: "linear",
    defaultMax: 5,
    setBonusPoints: 0,
    setBonusMax: 1,
  };
}

/** Rebuild the editor draft from a stored `loot_sweep` config. */
export function lootSweepFromConfig(config: Record<string, unknown> | null | undefined): LootSweepDraft {
  const c = (config ?? {}) as Record<string, unknown>;
  const rawItems = Array.isArray(c.items) ? (c.items as Record<string, unknown>[]) : [];
  return {
    items: rawItems.map((it) => ({
      name: String(it.item_name ?? it.name ?? ""),
      id: typeof it.item_id === "number" ? it.item_id : null,
      points: typeof it.points === "number" ? it.points : 1,
      maxAwards: typeof it.max_awards === "number" ? it.max_awards : null,
      countsForSet: it.counts_for_set !== false,
    })),
    decayPercent: typeof c.decay_percent === "number" ? c.decay_percent : 20,
    decayMode: c.decay_mode === "geometric" ? "geometric" : "linear",
    defaultMax: typeof c.default_max_awards === "number" ? c.default_max_awards : 5,
    setBonusPoints: typeof c.set_bonus_points === "number" ? c.set_bonus_points : 0,
    setBonusMax: typeof c.set_bonus_max === "number" ? c.set_bonus_max : 1,
  };
}

/** Serialize the draft into the task `config` the backend validates. */
export function lootSweepToConfig(d: LootSweepDraft): string {
  return JSON.stringify({
    kind: "loot_sweep",
    decay_percent: d.decayPercent,
    decay_mode: d.decayMode,
    default_max_awards: d.defaultMax,
    set_bonus_points: d.setBonusPoints,
    set_bonus_max: d.setBonusMax,
    items: d.items.map((i) => ({
      item_name: i.name,
      ...(i.id != null ? { item_id: i.id } : {}),
      points: i.points,
      ...(i.maxAwards != null ? { max_awards: i.maxAwards } : {}),
      ...(i.countsForSet ? {} : { counts_for_set: false }),
    })),
  });
}

const field =
  "bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment focus:ring-osrs-gold/60 rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1";

export function LootSweepEditor({
  value,
  onChange,
  search,
  resolve,
  disabled = false,
}: {
  value: LootSweepDraft;
  onChange: (next: LootSweepDraft) => void;
  search: (q: string) => Promise<EventMetaEntry[]>;
  resolve?: (names: string[]) => Promise<EventMetaEntry[]>;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EventMetaEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);
  const resolveTried = useRef<Set<string>>(new Set());

  const names = new Set(value.items.map((i) => i.name.toLowerCase()));

  // Debounced live item search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const rows = await search(q);
        if (seq.current === mine) setResults(rows);
      } catch {
        if (seq.current === mine) setResults([]);
      } finally {
        if (seq.current === mine) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, search]);

  // Back-fill icon ids for items loaded from a stored task that lack them.
  useEffect(() => {
    if (!resolve) return;
    const missing = value.items
      .filter((i) => i.id == null && !resolveTried.current.has(i.name))
      .map((i) => i.name);
    if (!missing.length) return;
    missing.forEach((n) => resolveTried.current.add(n));
    let cancelled = false;
    resolve(missing)
      .then((rows) => {
        if (cancelled || !rows.length) return;
        const idByName = new Map(rows.map((r) => [r.name.toLowerCase(), r.id]));
        onChange({
          ...value,
          items: value.items.map((i) =>
            i.id == null && idByName.has(i.name.toLowerCase())
              ? { ...i, id: idByName.get(i.name.toLowerCase()) }
              : i,
          ),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [value, resolve, onChange]);

  const patch = (p: Partial<LootSweepDraft>) => onChange({ ...value, ...p });

  const addItem = (entry: EventMetaEntry) => {
    if (disabled || names.has(entry.name.toLowerCase())) return;
    patch({
      items: [
        ...value.items,
        { name: entry.name, id: entry.id, points: 1, maxAwards: null, countsForSet: true },
      ],
    });
    setQuery("");
    setResults([]);
  };

  const patchItem = (idx: number, p: Partial<LootSweepItemDraft>) =>
    patch({ items: value.items.map((it, i) => (i === idx ? { ...it, ...p } : it)) });

  const removeItem = (idx: number) =>
    patch({ items: value.items.filter((_, i) => i !== idx) });

  return (
    <div className="grid gap-4">
      {/* ── set-wide scoring rules ─────────────────────────────────────────── */}
      <fieldset className="border-osrs-bronze/25 bg-osrs-brown-dark/20 grid gap-3 rounded-lg border p-3">
        <legend className="text-osrs-parchment-dark/70 px-1 text-xs font-medium">
          Set scoring
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-xs">
            <span className="text-osrs-parchment-dark/80">Decay per receipt</span>
            <div className="flex items-center gap-1">
              <QuantityInput
                min={0}
                max={100}
                value={value.decayPercent}
                onChange={(n) => patch({ decayPercent: n })}
                disabled={disabled}
                className={`${field} w-16`}
              />
              <span className="text-osrs-parchment-dark/50">%</span>
            </div>
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-osrs-parchment-dark/80">Decay curve</span>
            <select
              value={value.decayMode}
              onChange={(e) => patch({ decayMode: e.target.value as LootSweepDecayMode })}
              disabled={disabled}
              className={field}
            >
              <option value="linear">Linear (100 · 80 · 60 …)</option>
              <option value="geometric">Geometric (100 · 80 · 64 …)</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-osrs-parchment-dark/80">Default max per item</span>
            <QuantityInput
              min={1}
              max={100}
              value={value.defaultMax}
              onChange={(n) => patch({ defaultMax: n })}
              disabled={disabled}
              className={field}
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">
            <span className="text-osrs-parchment-dark/80">Full-set bonus (points)</span>
            <QuantityInput
              min={0}
              emptyAs={0}
              value={value.setBonusPoints}
              onChange={(n) => patch({ setBonusPoints: n })}
              disabled={disabled}
              className={field}
              title="Points for collecting every set item at least once. 0 = no set bonus (standalone items)."
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-osrs-parchment-dark/80">Set bonus max (per team)</span>
            <QuantityInput
              min={1}
              max={100}
              value={value.setBonusMax}
              onChange={(n) => patch({ setBonusMax: n })}
              disabled={disabled || value.setBonusPoints <= 0}
              className={field}
              title="How many times a team can earn the set bonus (a second full set pays again)."
            />
          </label>
        </div>
      </fieldset>

      {/* ── item search ────────────────────────────────────────────────────── */}
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (results[0]) addItem(results[0]);
            }
          }}
          placeholder="Add an item to the set (exact in-game name)…"
          disabled={disabled}
          className={`${field} w-full`}
        />
        {query.trim().length >= 2 && (results.length > 0 || searching) && (
          <ul className="border-osrs-bronze/30 bg-osrs-brown-dark absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded border shadow-lg">
            {searching && !results.length ? (
              <li className="text-osrs-parchment-dark/50 px-3 py-2 text-xs">Searching…</li>
            ) : (
              results.map((r) => {
                const added = names.has(r.name.toLowerCase());
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => addItem(r)}
                      disabled={added}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                        added
                          ? "text-osrs-gold-bright/70"
                          : "text-osrs-parchment hover:bg-osrs-bronze/20"
                      }`}
                    >
                      <ItemDbIcon itemId={r.id} size={22} />
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                      {r.tracked === false && (
                        <span className="text-amber-500/80 text-xs">⚠ never dropped</span>
                      )}
                      <span className="text-osrs-parchment-dark/40 text-xs">
                        {added ? "✓ added" : "+"}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

      {/* ── item rows ──────────────────────────────────────────────────────── */}
      {value.items.length === 0 ? (
        <p className="border-osrs-bronze/20 text-osrs-parchment-dark/40 rounded border border-dashed px-3 py-6 text-center text-xs">
          Search above to add the items that make up this set. Each awards its
          points on first receipt, then less on every repeat.
        </p>
      ) : (
        <ul className="grid gap-2">
          {value.items.map((it, idx) => {
            const max = it.maxAwards ?? value.defaultMax;
            const seqPts = decaySequence(it.points, max, value.decayPercent, value.decayMode);
            return (
              <li
                key={it.name}
                className="border-osrs-bronze/20 bg-osrs-brown-dark/30 grid gap-2 rounded border p-2 sm:grid-cols-[auto_1fr_auto]"
              >
                <div className="flex items-center gap-2">
                  <ItemDbIcon itemId={it.id} size={28} />
                  <span className="text-osrs-parchment text-sm font-medium">{it.name}</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1 text-xs">
                    <span className="text-osrs-parchment-dark/70">Points</span>
                    <QuantityInput
                      min={1}
                      value={it.points}
                      onChange={(n) => patchItem(idx, { points: n })}
                      disabled={disabled}
                      className={`${field} w-16`}
                      title="Points the FIRST receipt is worth."
                    />
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <span className="text-osrs-parchment-dark/70">Max</span>
                    <QuantityInput
                      min={1}
                      max={100}
                      value={it.maxAwards ?? value.defaultMax}
                      onChange={(n) => patchItem(idx, { maxAwards: n })}
                      disabled={disabled}
                      className={`${field} w-14`}
                      title="Scoring receipts before this item stops paying. Overrides the set default."
                    />
                  </label>
                  <label
                    className="flex items-center gap-1.5 text-xs"
                    title="Required for the full-set bonus? Turn off for extras like pets."
                  >
                    <input
                      type="checkbox"
                      checked={it.countsForSet}
                      onChange={(e) => patchItem(idx, { countsForSet: e.target.checked })}
                      disabled={disabled}
                      className="accent-osrs-gold"
                    />
                    <span className="text-osrs-parchment-dark/70">In set</span>
                  </label>
                  {/* live decay preview */}
                  <span
                    className="text-osrs-parchment-dark/60 ml-auto font-mono text-[11px]"
                    title="Points per successive receipt"
                  >
                    {seqPts.join(" · ")}
                  </span>
                </div>

                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-osrs-parchment-dark/50 hover:text-osrs-red justify-self-end text-sm"
                    aria-label={`Remove ${it.name}`}
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
