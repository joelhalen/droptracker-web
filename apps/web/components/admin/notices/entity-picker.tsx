"use client";

/**
 * Typeahead for the pop-up audience builder: find accounts (by name, Discord
 * id, user id or any linked RSN) or groups, and keep the picks as chips.
 * Search runs through a server action; the parent owns the id list and the
 * id -> name map so chips survive re-renders and reloads.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { NoticeLookupHit } from "@droptracker/api-types";
import { lookupNoticeTargets } from "@/app/(site)/(admin)/admin/notices/actions";
import { Input, cn } from "@/components/ui";

const SEARCH_DEBOUNCE_MS = 250;

export function EntityPicker({
  kind,
  selected,
  names,
  onChange,
  placeholder,
  emptyLabel,
}: {
  kind: "user" | "group";
  selected: number[];
  /** id (as string) -> display name, for chips. */
  names: Record<string, string>;
  onChange: (ids: number[], added?: NoticeLookupHit) => void;
  placeholder: string;
  /** Shown when nothing is picked (e.g. "Any group"). */
  emptyLabel?: string;
}) {
  const listId = useId();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<NoticeLookupHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setHits([]);
      setLoading(false);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    const timer = setTimeout(() => {
      lookupNoticeTargets(kind, query)
        .then((items) => {
          if (seq.current !== mine) return;
          setHits(items);
          setActive(0);
        })
        .catch(() => seq.current === mine && setHits([]))
        .finally(() => seq.current === mine && setLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [kind, q]);

  const add = (hit: NoticeLookupHit) => {
    if (!selected.includes(hit.id)) onChange([...selected, hit.id], hit);
    setQ("");
    setHits([]);
    setOpen(false);
  };

  const remove = (id: number) => onChange(selected.filter((x) => x !== id));
  const visible = hits.filter((h) => !selected.includes(h.id));

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          fieldSize="sm"
          role="combobox"
          aria-expanded={open && visible.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          value={q}
          placeholder={placeholder}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, Math.max(visible.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              // Never submit the surrounding form from the search box.
              e.preventDefault();
              const hit = visible[active];
              if (hit) add(hit);
            } else if (e.key === "Escape") {
              setQ("");
              setOpen(false);
            }
          }}
          className="w-full"
        />
        {open && q.trim() && (
          <ul
            id={listId}
            role="listbox"
            className="border-osrs-bronze/40 bg-osrs-surface-2 shadow-osrs-pop absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border py-1"
          >
            {visible.length === 0 ? (
              <li className="text-osrs-parchment-dark/60 px-3 py-2 text-xs">
                {loading ? "Searching…" : "No matches."}
              </li>
            ) : (
              visible.map((hit, i) => (
                <li key={hit.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(hit)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex w-full flex-col items-start px-3 py-1.5 text-left",
                      i === active ? "bg-osrs-bronze/25" : "",
                    )}
                  >
                    <span className="text-osrs-parchment text-sm">{hit.name}</span>
                    <span className="text-osrs-parchment-dark/60 text-[11px]">{hit.detail}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <li
              key={id}
              className="border-osrs-gold/40 bg-osrs-gold/10 text-osrs-parchment flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-xs"
            >
              {names[String(id)] ?? `${kind === "user" ? "User" : "Group"} #${id}`}
              <button
                type="button"
                onClick={() => remove(id)}
                aria-label={`Remove ${names[String(id)] ?? id}`}
                className="text-osrs-parchment-dark/60 hover:text-osrs-red rounded-full px-1"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        emptyLabel && <p className="text-osrs-parchment-dark/50 text-xs">{emptyLabel}</p>
      )}
    </div>
  );
}
