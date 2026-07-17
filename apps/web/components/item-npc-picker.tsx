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

import { useEffect, useRef, useState } from "react";
import type { EventMetaEntry } from "@droptracker/api-types";
import { QuantityInput } from "@/components/quantity-input";

const IMG_BASE = "https://www.droptracker.io/img";

export type PickerEntry = {
  name: string;
  /** Game id for the icon; null/undefined until resolved (icon hidden). */
  id?: number | null;
  /** Per-item weight (point-collection lists only). */
  points?: number;
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
}) {
  const noun = kind === "item" ? "item" : "NPC";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EventMetaEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
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
        const rows = await search(q);
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
  }, [query]);

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

  const add = (entry: { name: string; id?: number | null }) => {
    if (disabled) return;
    if (mode === "single") {
      onChange([{ name: entry.name, id: entry.id }]);
      setQuery("");
      setResults([]);
      setSearched(false);
      return;
    }
    if (selectedNames.has(entry.name)) return;
    onChange([
      ...selected,
      withPoints ? { name: entry.name, id: entry.id, points: 1 } : { name: entry.name, id: entry.id },
    ]);
  };

  const remove = (name: string) => {
    if (disabled) return;
    onChange(selected.filter((s) => s.name !== name));
  };

  const setPoints = (name: string, points: number) => {
    onChange(selected.map((s) => (s.name === name ? { ...s, points } : s)));
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
        <div className="border-osrs-bronze/20 border-b p-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter = take the top result (keyboard fast path).
              if (e.key === "Enter") {
                e.preventDefault();
                if (results[0]) add(results[0]);
              }
            }}
            placeholder={placeholder ?? `Search ${noun}s…`}
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
                      dragEntry.current = { name: r.name, id: r.id };
                      droppedInSelection.current = false;
                      setDragging({ from: "results" });
                      e.dataTransfer.effectAllowed = "copy";
                      e.dataTransfer.setData("text/plain", r.name);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      dragEntry.current = null;
                    }}
                    onClick={() => (isSelected ? remove(r.name) : add(r))}
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
              Type at least 2 letters to search the {noun} database.
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
              <li
                key={s.name}
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
                {withPoints && (
                  <label className="flex shrink-0 items-center gap-1">
                    <QuantityInput
                      min={0.1}
                      integer={false}
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
    </div>
  );
}
