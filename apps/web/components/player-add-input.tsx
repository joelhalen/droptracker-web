"use client";

/**
 * Add players to an event team: one search box that covers both flows.
 *
 *  - Type a name → live results appear in a dropdown as you type (250ms
 *    debounce, stale responses dropped — same pattern as ItemNpcPicker).
 *    Click a row (or press Enter for the top hit) to add that player.
 *  - Paste a comma- or newline-separated list → the box flips to "list
 *    mode" and one click sends the whole list to the bulk endpoint, which
 *    reports per-name outcomes (added / skipped with a reason) that are
 *    shown inline.
 *
 * The parent owns the actual add calls (server actions bound to the event/
 * team), so this component works in both the event manager and the setup
 * wizard.
 */
import { useEffect, useRef, useState } from "react";
import type { EventTeamBulkAddResult } from "@droptracker/api-types";
import { getErrorMessage } from "@/lib/errors";

export type PlayerHit = { id: number; name: string };

/** "a, b\nc" → ["a", "b", "c"] — trimmed, de-duplicated case-insensitively. */
export function parseNameList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,\n]/)) {
    const name = part.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";

export function PlayerAddInput({
  placeholder = "Add players — type a name, or paste a list…",
  existingIds,
  disabled = false,
  search,
  onPick,
  onBulkAdd,
}: {
  placeholder?: string;
  /** Player ids already on the team — hidden from search results. */
  existingIds: number[];
  disabled?: boolean;
  search: (q: string) => Promise<PlayerHit[]>;
  onPick: (player: PlayerHit) => void;
  onBulkAdd?: (names: string[]) => Promise<EventTeamBulkAddResult>;
}) {
  const [value, setValue] = useState("");
  const [results, setResults] = useState<PlayerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkResult, setBulkResult] = useState<EventTeamBulkAddResult | null>(null);
  const seq = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const listNames = value.includes(",") || value.includes("\n") ? parseNameList(value) : [];
  const listMode = onBulkAdd != null && listNames.length > 0;

  const existing = new Set(existingIds);
  const visible = results.filter((p) => !existing.has(p.id));

  // Debounced live search (disabled while a pasted list is pending).
  useEffect(() => {
    const q = value.trim();
    if (listMode || q.length < 2) {
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
          setOpen(true);
        }
      } catch (err) {
        if (seq.current === mine) {
          setResults([]);
          setError(getErrorMessage(err, "Search failed. Please try again."));
        }
      } finally {
        if (seq.current === mine) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [value, listMode]);

  // Click-away closes the dropdown.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (player: PlayerHit) => {
    setValue("");
    setResults([]);
    setSearched(false);
    setOpen(false);
    setError(null);
    onPick(player);
  };

  const runBulk = async () => {
    if (!onBulkAdd || !listNames.length || bulkPending) return;
    setBulkPending(true);
    setError(null);
    try {
      const result = await onBulkAdd(listNames);
      setBulkResult(result);
      setValue("");
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't add the list. Please try again."));
    } finally {
      setBulkPending(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
            setBulkResult(null);
          }}
          onFocus={() => visible.length && setOpen(true)}
          onPaste={(e) => {
            // Pasting into an <input> would silently strip newlines and fuse
            // names together — normalize them to commas ourselves.
            const text = e.clipboardData.getData("text");
            if (text.includes("\n")) {
              e.preventDefault();
              const el = e.currentTarget;
              const next =
                el.value.slice(0, el.selectionStart ?? el.value.length) +
                text.replace(/\s*\n+\s*/g, ", ") +
                el.value.slice(el.selectionEnd ?? el.value.length);
              setValue(next);
              setBulkResult(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (listMode) void runBulk();
              else if (visible.length) pick(visible[0]!);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          disabled={disabled || bulkPending}
          className={`${field} flex-1`}
          aria-label="Add players by name"
        />
        {listMode && (
          <button
            type="button"
            onClick={() => void runBulk()}
            disabled={disabled || bulkPending}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark shrink-0 rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {bulkPending
              ? "Adding…"
              : `Add ${listNames.length} player${listNames.length === 1 ? "" : "s"}`}
          </button>
        )}
      </div>

      {listMode && !bulkPending && (
        <p className="text-osrs-parchment-dark/60 mt-1 text-xs">
          Looks like a list — players who exist and are eligible get added; anything else is
          reported back, nothing is moved off other teams.
        </p>
      )}

      {searching && !listMode && (
        <p className="text-osrs-parchment-dark/50 mt-1 text-xs">Searching…</p>
      )}
      {error && <p className="text-osrs-red mt-1 text-xs">{error}</p>}

      {open && !listMode && searched && !searching && (
        <ul className="bg-osrs-brown-dark border-osrs-bronze/40 absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded border shadow-lg">
          {visible.length ? (
            visible.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pick(p)}
                  disabled={disabled}
                  className="hover:bg-osrs-bronze/10 flex w-full items-center justify-between px-3 py-1.5 text-left text-sm disabled:opacity-50"
                >
                  <span>{p.name}</span>
                  <span className="text-osrs-gold-bright text-xs">Add</span>
                </button>
              </li>
            ))
          ) : (
            <li className="text-osrs-parchment-dark/50 px-3 py-2 text-xs">
              No matching players found.
            </li>
          )}
        </ul>
      )}

      {bulkResult && (
        <div className="border-osrs-bronze/30 bg-osrs-brown-dark/30 mt-2 rounded border p-2 text-xs">
          <div className="flex items-start justify-between gap-2">
            <p>
              {bulkResult.added.length > 0 ? (
                <span className="text-osrs-green">
                  Added {bulkResult.added.length} player
                  {bulkResult.added.length === 1 ? "" : "s"}.
                </span>
              ) : (
                <span className="text-osrs-parchment-dark/70">No players added.</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setBulkResult(null)}
              className="text-osrs-parchment-dark/60 hover:text-osrs-parchment shrink-0"
              aria-label="Dismiss result"
            >
              ✕
            </button>
          </div>
          {bulkResult.skipped.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {bulkResult.skipped.map((row) => (
                <li key={row.name} className="text-osrs-parchment-dark/70">
                  <span className="text-osrs-parchment/90 font-medium">{row.name}</span> —{" "}
                  {row.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
