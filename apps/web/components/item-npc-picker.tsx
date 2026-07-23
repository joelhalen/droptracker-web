"use client";

/**
 * Item/NPC picker for the event task builder — a live search card whose
 * results (icon + name tiles) can be clicked *or* dragged into the selection
 * panel next to it. Selected entries drag back out (or ×) to remove, and can
 * carry a per-item points weight (point-collection tasks).
 *
 * Everything drag can do, click can do too (mobile/keyboard: tap a result to
 * add, tap × to remove, Enter adds the top result) — drag-and-drop is the
 * fast path, not the only path. Names are exact in-game names (the engine
 * matches by name); ids ride along purely for the itemdb/npcdb icons, and
 * `resolve` back-fills them when editing a task that only stored names.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { EventMetaEntry } from "@droptracker/api-types";
import { QuantityInput } from "@/components/quantity-input";

const IMG_BASE = "https://www.droptracker.io/img";

export type PickerEntry = {
  name: string;
  /** Game id for the icon; null/undefined until resolved (icon hidden). */
  id?: number | null;
  /** Per-item weight (point-collection lists only). */
  points?: number;
  /** Source-NPC restriction (item tasks): the item only counts when it drops
   * from one of these NPCs. Empty/absent = any source. */
  npcs?: string[];
  /** This entry is a PET: it credits from a pet submission (config.pet_items),
   * not from drops/clogs, and has no drop-source restriction. */
  isPet?: boolean;
};

/** Backing calls for the "import a boss's drops" helper: NPC autocomplete +
 * that NPC's droppable items (wiki table with tracked-drop fallback). */
export type BossImportApi = {
  searchNpcs: (q: string) => Promise<EventMetaEntry[]>;
  fetchDrops: (npcId: number) => Promise<EventMetaEntry[]>;
};

function EntityIcon({
  kind,
  id,
  size = 24,
}: {
  kind: "item" | "npc";
  id: number | null | undefined;
  size?: number;
}) {
  if (id == null) {
    return <span style={{ width: size, height: size }} className="inline-block shrink-0" />;
  }
  return (
    <img
      src={`${IMG_BASE}/${kind === "item" ? "itemdb" : "npcdb"}/${id}.png`}
      alt=""
      width={size}
      height={size}
      className="inline-block shrink-0 object-contain"
      draggable={false}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}

/** Collapsible "type a boss, get its drops" panel under the item picker —
 * search an NPC, list its droppable items, add them per-item or all at once
 * instead of hunting each item down individually. */
function BossDropsImport({
  api,
  selectedNames,
  onToggleEntry,
  onAddMany,
  disabled,
}: {
  api: BossImportApi;
  selectedNames: Set<string>;
  /** Click on one drop chip: add when absent, remove when present. */
  onToggleEntry: (entry: EventMetaEntry, isSelected: boolean) => void;
  onAddMany: (entries: EventMetaEntry[]) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [npcResults, setNpcResults] = useState<EventMetaEntry[]>([]);
  const [npcOpen, setNpcOpen] = useState(false);
  const [npc, setNpc] = useState<EventMetaEntry | null>(null);
  const [drops, setDrops] = useState<EventMetaEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);

  // Debounced NPC autocomplete (same pattern as the main search pane).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setNpcResults([]);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const rows = await api.searchNpcs(q);
        if (seq.current === mine) {
          setNpcResults(rows);
          setNpcOpen(true);
        }
      } catch {
        if (seq.current === mine) setNpcResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const pickNpc = async (entry: EventMetaEntry) => {
    setNpc(entry);
    setQuery("");
    setNpcResults([]);
    setNpcOpen(false);
    setDrops(null);
    setFailed(false);
    setLoading(true);
    try {
      setDrops(await api.fetchDrops(entry.id));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const missing = (drops ?? []).filter((d) => !selectedNames.has(d.name));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright justify-self-start rounded border px-3 py-1.5 text-xs"
      >
        + Import a boss&apos;s drop table
      </button>
    );
  }

  return (
    <div className="border-osrs-bronze/25 bg-osrs-brown-dark/30 grid gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span className="text-osrs-parchment-dark/80 text-xs font-medium">
          Import a boss&apos;s drop table
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setNpc(null);
            setDrops(null);
            setQuery("");
          }}
          className="text-osrs-parchment-dark/50 hover:text-osrs-red ml-auto text-xs"
        >
          Close
        </button>
      </div>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => npcResults.length && setNpcOpen(true)}
          onBlur={() => setTimeout(() => setNpcOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (npcResults[0]) void pickNpc(npcResults[0]);
            }
          }}
          placeholder="Search a boss… (e.g. Zulrah, Wintertodt)"
          disabled={disabled}
          className="bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 focus:ring-osrs-gold/60 w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1"
        />
        {npcOpen && npcResults.length > 0 && (
          <ul className="bg-osrs-brown-dark border-osrs-bronze/40 absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded border shadow-lg">
            {npcResults.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void pickNpc(r)}
                  className="text-osrs-parchment hover:bg-osrs-bronze/20 flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
                >
                  <EntityIcon kind="npc" id={r.id} size={20} />
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {loading ? (
        <p className="text-osrs-parchment-dark/50 text-xs">Loading drop table…</p>
      ) : failed ? (
        <p className="text-osrs-red/80 text-xs">Couldn&apos;t load the drop table — try again.</p>
      ) : npc && drops ? (
        drops.length ? (
          <>
            <div className="flex items-center gap-2">
              <EntityIcon kind="npc" id={npc.id} size={20} />
              <span className="text-osrs-gold-bright text-xs font-semibold">
                {npc.name} — {drops.length} item{drops.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => onAddMany(missing)}
                disabled={disabled || !missing.length}
                className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright ml-auto rounded border px-2 py-1 text-xs disabled:opacity-50"
              >
                {missing.length ? `Add all (${missing.length})` : "All added ✓"}
              </button>
            </div>
            <ul className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
              {drops.map((d) => {
                const isSelected = selectedNames.has(d.name);
                const untracked = d.tracked === false;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => onToggleEntry(d, isSelected)}
                      disabled={disabled}
                      title={
                        isSelected
                          ? `Remove ${d.name}`
                          : untracked
                            ? `${d.name} has never been recorded as a drop — a task requiring it may be impossible to complete`
                            : `Add ${d.name}`
                      }
                      className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${
                        isSelected
                          ? "border-osrs-gold bg-osrs-gold/15 text-osrs-gold-bright"
                          : "border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold"
                      }`}
                    >
                      <EntityIcon kind="item" id={d.id} size={16} />
                      <span>{d.name}</span>
                      {untracked && (
                        <span className="text-amber-500" title="Never seen in tracked drops">
                          ⚠
                        </span>
                      )}
                      {isSelected && <span>✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="text-osrs-parchment-dark/50 text-xs">
            No known drops for {npc.name}.
          </p>
        )
      ) : (
        <p className="text-osrs-parchment-dark/40 text-xs">
          Pick a boss to list its drops, then add them one by one or all at once.
        </p>
      )}
    </div>
  );
}

export function ItemNpcPicker({
  kind,
  mode = "list",
  withPoints = false,
  selected,
  onChange,
  search,
  resolve,
  disabled = false,
  placeholder,
  selectionTitle,
  emptyHint,
  renderEntryExtra,
  bossImport,
  searchPets,
}: {
  kind: "item" | "npc";
  /** "single" keeps at most one entry (picking another replaces it). */
  mode?: "single" | "list";
  /** Show a per-entry points input (point-collection lists). */
  withPoints?: boolean;
  selected: PickerEntry[];
  onChange: (next: PickerEntry[]) => void;
  search: (q: string) => Promise<EventMetaEntry[]>;
  /** Batch exact-name → id lookup, used to back-fill icons in edit mode. */
  resolve?: (names: string[]) => Promise<EventMetaEntry[]>;
  disabled?: boolean;
  placeholder?: string;
  selectionTitle?: string;
  /** Hint inside an empty selection panel. */
  emptyHint?: string;
  /** Extra UI rendered under each selected row (e.g. a per-item source-NPC
   * restriction); `setNpcs` writes that entry's `npcs`. */
  renderEntryExtra?: (entry: PickerEntry, setNpcs: (npcs: string[]) => void) => ReactNode;
  /** Enables the "import a boss's drops" helper (item lists only): search an
   * NPC, then bulk-add its droppable items. */
  bossImport?: BossImportApi;
  /** Enables the Items/Pets search toggle (item lists only): pet results add
   * `isPet` entries, credited from pet submissions instead of drops. */
  searchPets?: (q: string) => Promise<EventMetaEntry[]>;
}) {
  const noun = kind === "item" ? "item" : "NPC";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EventMetaEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  /** Which database the search box hits ("pet" only when searchPets is set). */
  const [searchKind, setSearchKind] = useState<"item" | "pet">("item");
  const petsEnabled = searchPets != null && kind === "item" && mode === "list";
  const petMode = petsEnabled && searchKind === "pet";
  /** What's being dragged: a search result in, or a selected row out. */
  const [dragging, setDragging] = useState<null | { from: "results" | "selection" }>(null);
  const [overSelection, setOverSelection] = useState(false);
  const [overResults, setOverResults] = useState(false);
  const seq = useRef(0);
  const dragEntry = useRef<PickerEntry | null>(null);
  const droppedInSelection = useRef(false);
  const resolveTried = useRef<Set<string>>(new Set());

  const selectedNames = new Set(selected.map((s) => s.name));

  // Debounced live search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setSearched(false);
      return;
    }
    setSearching(true);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const rows = await (petMode && searchPets ? searchPets(q) : search(q));
        if (seq.current === mine) {
          setResults(rows);
          setSearched(true);
        }
      } catch {
        if (seq.current === mine) setResults([]);
      } finally {
        if (seq.current === mine) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, petMode]);

  // Back-fill icon ids for entries loaded from a stored task (names only).
  useEffect(() => {
    if (!resolve) return;
    const missing = selected
      .filter((s) => s.id == null && !resolveTried.current.has(s.name))
      .map((s) => s.name);
    if (!missing.length) return;
    missing.forEach((n) => resolveTried.current.add(n));
    let cancelled = false;
    resolve(missing)
      .then((rows) => {
        if (cancelled || !rows.length) return;
        const idByName = new Map(rows.map((r) => [r.name, r.id]));
        onChange(
          selected.map((s) =>
            s.id == null && idByName.has(s.name) ? { ...s, id: idByName.get(s.name) } : s,
          ),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selected, resolve]);

  const add = (entry: { name: string; id?: number | null; isPet?: boolean }) => {
    if (disabled) return;
    const pet = entry.isPet ? { isPet: true as const } : {};
    if (mode === "single") {
      onChange([{ name: entry.name, id: entry.id, ...pet }]);
      setQuery("");
      setResults([]);
      setSearched(false);
      return;
    }
    if (selectedNames.has(entry.name)) return;
    onChange([
      ...selected,
      { name: entry.name, id: entry.id, ...(withPoints ? { points: 1 } : {}), ...pet },
    ]);
  };

  const remove = (name: string) => {
    if (disabled) return;
    onChange(selected.filter((s) => s.name !== name));
  };

  /** Bulk add (boss-drops import) — one onChange so React state stays sane. */
  const addMany = (entries: { name: string; id?: number | null }[]) => {
    if (disabled || mode === "single") return;
    const additions = entries
      .filter((e) => !selectedNames.has(e.name))
      .map((e) =>
        withPoints ? { name: e.name, id: e.id, points: 1 } : { name: e.name, id: e.id },
      );
    if (additions.length) onChange([...selected, ...additions]);
  };

  const setPoints = (name: string, points: number) => {
    onChange(selected.map((s) => (s.name === name ? { ...s, points } : s)));
  };

  const setEntryNpcs = (name: string, npcs: string[]) => {
    onChange(selected.map((s) => (s.name === name ? { ...s, npcs } : s)));
  };

  const paneBase =
    "border-osrs-bronze/30 bg-osrs-brown-dark/40 flex min-h-40 flex-col rounded border transition-colors";

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {/* ── search pane ──────────────────────────────────────────────────── */}
      <div
        className={`${paneBase} ${overResults && dragging?.from === "selection" ? "border-osrs-red/60 bg-osrs-red/5" : ""}`}
        onDragOver={(e) => {
          if (dragging?.from === "selection") {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setOverResults(true);
          }
        }}
        onDragLeave={() => setOverResults(false)}
        onDrop={(e) => {
          // Dropping a selected row back on the search pane removes it.
          if (dragging?.from === "selection" && dragEntry.current) {
            e.preventDefault();
            remove(dragEntry.current.name);
          }
          setOverResults(false);
        }}
      >
        <div className="border-osrs-bronze/20 flex gap-2 border-b p-2">
          {petsEnabled && (
            <div className="border-osrs-bronze/30 flex shrink-0 overflow-hidden rounded border text-xs">
              {(["item", "pet"] as const).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setSearchKind(k)}
                  aria-pressed={searchKind === k}
                  title={
                    k === "pet"
                      ? "Search pets — a pet on the list is credited from its pet submission"
                      : "Search the item database"
                  }
                  className={`px-2 py-1 ${
                    searchKind === k
                      ? "bg-osrs-gold/15 text-osrs-gold-bright"
                      : "text-osrs-parchment-dark/60 hover:text-osrs-parchment"
                  }`}
                >
                  {k === "item" ? "Items" : "Pets"}
                </button>
              ))}
            </div>
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter = take the top result (keyboard fast path).
              if (e.key === "Enter") {
                e.preventDefault();
                if (results[0])
                  add({ name: results[0].name, id: results[0].id, isPet: petMode || undefined });
              }
            }}
            placeholder={petMode ? "Search pets…" : (placeholder ?? `Search ${noun}s…`)}
            disabled={disabled}
            className="bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 focus:ring-osrs-gold/60 w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1"
          />
        </div>
        <ul className="max-h-56 flex-1 overflow-y-auto p-1">
          {dragging?.from === "selection" ? (
            <li className="text-osrs-red/80 px-2 py-6 text-center text-xs">
              Drop here to remove
            </li>
          ) : searching && !results.length ? (
            <li className="text-osrs-parchment-dark/50 px-2 py-2 text-xs">Searching…</li>
          ) : results.length ? (
            results.map((r) => {
              const isSelected = selectedNames.has(r.name);
              const untracked = r.tracked === false;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    draggable={!disabled && !isSelected}
                    onDragStart={(e) => {
                      dragEntry.current = { name: r.name, id: r.id, isPet: petMode || undefined };
                      droppedInSelection.current = false;
                      setDragging({ from: "results" });
                      e.dataTransfer.effectAllowed = "copy";
                      e.dataTransfer.setData("text/plain", r.name);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      dragEntry.current = null;
                    }}
                    onClick={() =>
                      isSelected
                        ? remove(r.name)
                        : add({ name: r.name, id: r.id, isPet: petMode || undefined })
                    }
                    disabled={disabled}
                    title={
                      isSelected
                        ? `Remove ${r.name}`
                        : untracked
                          ? `${r.name} has never been recorded as a drop — a task requiring it may be impossible to complete`
                          : `Add ${r.name} — click, or drag it across`
                    }
                    className={`flex w-full cursor-grab items-center gap-2 rounded px-2 py-1.5 text-left text-sm active:cursor-grabbing ${
                      isSelected
                        ? "text-osrs-gold-bright/80"
                        : "text-osrs-parchment hover:bg-osrs-bronze/20"
                    }`}
                  >
                    <EntityIcon kind={kind} id={r.id} />
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span
                      className={`shrink-0 text-xs ${
                        isSelected
                          ? "text-osrs-gold-bright"
                          : untracked
                            ? "text-amber-500/80"
                            : "text-osrs-parchment-dark/40"
                      }`}
                    >
                      {isSelected ? "✓ added" : untracked ? "⚠ never dropped" : "+"}
                    </span>
                  </button>
                </li>
              );
            })
          ) : searched && query.trim().length >= 2 ? (
            <li className="text-osrs-parchment-dark/50 px-2 py-2 text-xs">
              No matches — exact in-game names only.
            </li>
          ) : (
            <li className="text-osrs-parchment-dark/40 px-2 py-2 text-xs">
              Type at least 2 letters to search the {petMode ? "pet" : noun} database.
            </li>
          )}
        </ul>
      </div>

      {/* ── selection pane (drop zone) ───────────────────────────────────── */}
      <div
        className={`${paneBase} ${
          overSelection && dragging?.from === "results"
            ? "border-osrs-gold bg-osrs-gold/5"
            : dragging?.from === "results"
              ? "border-osrs-gold/50 border-dashed"
              : ""
        }`}
        onDragOver={(e) => {
          if (dragging?.from === "results") {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setOverSelection(true);
          }
        }}
        onDragLeave={() => setOverSelection(false)}
        onDrop={(e) => {
          if (dragging?.from === "results" && dragEntry.current) {
            e.preventDefault();
            add(dragEntry.current);
          }
          droppedInSelection.current = true;
          setOverSelection(false);
        }}
      >
        <div className="border-osrs-bronze/20 flex items-center justify-between border-b p-2">
          <span className="text-osrs-parchment-dark/80 text-xs font-medium">
            {selectionTitle ?? (mode === "single" ? `Selected ${noun}` : `Selected ${noun}s`)}
            {mode === "list" && selected.length > 0 && (
              <span className="text-osrs-gold-bright ml-1.5">({selected.length})</span>
            )}
          </span>
          {mode === "list" && selected.length > 1 && !disabled && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-osrs-parchment-dark/50 hover:text-osrs-red text-xs"
            >
              Clear all
            </button>
          )}
        </div>
        <ul className="max-h-56 flex-1 overflow-y-auto p-1">
          {selected.length ? (
            selected.map((s) => (
              <li key={s.name} className="rounded">
                <div
                  draggable={!disabled}
                  onDragStart={(e) => {
                    dragEntry.current = s;
                    droppedInSelection.current = false;
                    setDragging({ from: "selection" });
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", s.name);
                  }}
                  onDragEnd={() => {
                    // Dragged out of the panel (anywhere) = remove.
                    if (!droppedInSelection.current && dragEntry.current) {
                      remove(dragEntry.current.name);
                    }
                    setDragging(null);
                    dragEntry.current = null;
                  }}
                  className="hover:bg-osrs-bronze/10 flex cursor-grab items-center gap-2 rounded px-2 py-1.5 text-sm active:cursor-grabbing"
                  title="Drag out (or ×) to remove"
                >
                  <EntityIcon kind={kind} id={s.id} />
                  <span className="text-osrs-parchment min-w-0 flex-1 truncate">{s.name}</span>
                  {s.isPet && (
                    <span
                      className="border-osrs-gold/40 text-osrs-gold-bright/80 shrink-0 rounded border px-1 text-[10px] uppercase"
                      title="Credited from a pet submission (not drops)"
                    >
                      pet
                    </span>
                  )}
                  {withPoints && (
                    <label className="flex shrink-0 items-center gap-1">
                      <QuantityInput
                        min={1}
                        value={s.points ?? 1}
                        disabled={disabled}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(points) => setPoints(s.name, points)}
                        className="bg-osrs-brown-dark/80 border-osrs-bronze/30 text-osrs-parchment w-16 rounded border px-1 py-0.5 text-center text-xs"
                        title={`Points one ${s.name} is worth`}
                      />
                      <span className="text-osrs-parchment-dark/50 text-[10px]">pts</span>
                    </label>
                  )}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => remove(s.name)}
                      className="text-osrs-parchment-dark/60 hover:text-osrs-red shrink-0 rounded px-1.5 text-sm"
                      aria-label={`Remove ${s.name}`}
                    >
                      ×
                    </button>
                  )}
                </div>
                {/* Pets have no drop source — the source restriction (or any
                    per-item extra) doesn't apply to them. */}
                {renderEntryExtra && !s.isPet && (
                  <div className="px-2 pb-1.5">
                    {renderEntryExtra(s, (npcs) => setEntryNpcs(s.name, npcs))}
                  </div>
                )}
              </li>
            ))
          ) : (
            <li className="text-osrs-parchment-dark/40 px-2 py-6 text-center text-xs">
              {emptyHint ??
                (mode === "single"
                  ? `Search on the left, then click or drag the ${noun} here.`
                  : `Search on the left, then click or drag ${noun}s here to build the list.`)}
            </li>
          )}
        </ul>
      </div>

      {/* ── boss-drops import (item lists only) ──────────────────────────── */}
      {bossImport && kind === "item" && mode === "list" && (
        <div className="sm:col-span-2">
          <BossDropsImport
            api={bossImport}
            selectedNames={selectedNames}
            onToggleEntry={(entry, isSelected) =>
              isSelected ? remove(entry.name) : add(entry)
            }
            onAddMany={addMany}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
