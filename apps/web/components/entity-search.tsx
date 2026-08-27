"use client";

/**
 * Live entity search: a search field with a debounced typeahead popup
 * (`card-pop`) that populates as you type, so nobody has to submit a form just
 * to find a player or clan. One component backs every search surface — the
 * homepage hero (via `HeroSearch`), the `/search` page, and the page-scoped
 * bars on the leaderboard tabs — differing only by `kinds` scope and size.
 * Suggestions come from the BFF (`/api/search`); Enter (or the button) still
 * falls through to the full `/search` page for complete results.
 */
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { entityPath } from "@/lib/slug";
import { cycleActive } from "@/lib/listbox";
import { useEffect, useId, useRef, useState } from "react";
import type { SearchResults } from "@droptracker/api-types";
import {
  ALL_SEARCH_KINDS,
  MIN_SEARCH_LENGTH,
  SEARCH_DEBOUNCE_MS,
  SEARCH_KIND_LABELS,
  toSuggestions,
  type SearchKind,
  type Suggestion,
} from "@/lib/search-suggestions";

export type { SearchKind };

const INPUT_SIZES = {
  // Hero field: large, translucent over the hero art.
  lg: "border-osrs-bronze/50 bg-osrs-brown-dark/60 focus:border-osrs-gold placeholder:text-osrs-parchment-dark/50 w-full rounded-lg border py-3 pr-3 pl-9 text-base outline-none backdrop-blur-sm",
  // In-page field: compact, matches the standard form inputs.
  md: "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold placeholder:text-osrs-parchment-dark/50 w-full rounded-lg border py-2 pr-3 pl-9 text-sm outline-none",
} as const;

const BUTTON_SIZES = {
  lg: "bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded-lg px-5 py-3 text-sm font-semibold transition-colors",
  md: "bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
} as const;

export function EntitySearch({
  kinds = ALL_SEARCH_KINDS,
  placeholder = "Find a player, clan, boss or item…",
  initial = "",
  size = "md",
  withButton = false,
  className = "",
}: {
  /** Which entity kinds to surface — scope this to the page's subject. */
  kinds?: readonly SearchKind[];
  placeholder?: string;
  initial?: string;
  size?: "md" | "lg";
  /** Render an explicit Search button (submits to the full /search page). */
  withButton?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const listboxId = useId();
  const [q, setQ] = useState(initial);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState(false);
  // Only search after the user actually types — an `initial` value must not
  // pop the dropdown open on page load (the /search page mounts with q set).
  const [interacted, setInteracted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // kinds is a fresh array literal each render; key the fetch effect on value.
  const kindsKey = kinds.join(",");

  // Debounced typeahead lookup. Stale responses are dropped by the cleanup
  // flag so fast typing can't reorder results.
  useEffect(() => {
    if (!interacted) return;
    const query = q.trim();
    if (query.length < MIN_SEARCH_LENGTH) {
      setSuggestions([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => (res.ok ? res.json() : { players: [], groups: [] }))
        .then((results: SearchResults) => {
          if (cancelled) return;
          setSuggestions(toSuggestions(results, kindsKey.split(",") as SearchKind[]));
          setActive(-1);
          setSearched(true);
          setOpen(true);
        })
        .catch(() => {
          /* best-effort — Enter still goes to /search */
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, interacted, kindsKey]);

  // Close the popup when clicking anywhere outside the component.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const go = (href: Route) => {
    setOpen(false);
    router.push(href);
  };

  /** A suggestion's site URL — the site's half of the shared shaping. */
  const hrefOf = (s: Suggestion) => entityPath(s.kind, s.id, s.name);

  const submit = () => {
    const query = q.trim();
    if (!query) return;
    const picked = active >= 0 ? suggestions[active] : undefined;
    if (picked) go(hrefOf(picked));
    else go(`/search?q=${encodeURIComponent(query)}` as Route);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!suggestions.length) return;
      setOpen(true);
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((prev) => cycleActive(prev, delta, suggestions.length));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  const showDropdown = open && q.trim().length >= MIN_SEARCH_LENGTH && searched;
  const showKindBadge = kinds.length > 1;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        role="search"
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <span
            aria-hidden
            className="text-osrs-parchment-dark/50 pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
          >
            ⌕
          </span>
          <input
            value={q}
            onChange={(e) => {
              setInteracted(true);
              setQ(e.target.value);
            }}
            onFocus={() => searched && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label={placeholder}
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            aria-autocomplete="list"
            autoComplete="off"
            className={INPUT_SIZES[size]}
          />
        </div>
        {withButton && (
          <button type="submit" className={BUTTON_SIZES[size]}>
            Search
          </button>
        )}
      </form>

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          className="card-pop menu-in absolute inset-x-0 top-full z-20 mt-2 overflow-hidden"
        >
          {suggestions.map((s, i) => (
            <li key={s.key} role="option" aria-selected={i === active}>
              <button
                type="button"
                onClick={() => go(hrefOf(s))}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm ${
                  i === active ? "bg-osrs-bronze/20" : ""
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {s.iconUrl && (
                    <img src={s.iconUrl} alt="" className="size-6 shrink-0 object-contain" />
                  )}
                  <span className="min-w-0">
                    <span className="text-osrs-parchment block truncate font-medium">{s.name}</span>
                    {s.detail && (
                      <span className="text-osrs-parchment-dark/60 block truncate text-xs">
                        {s.detail}
                      </span>
                    )}
                  </span>
                </span>
                {showKindBadge && (
                  <span className="text-osrs-parchment-dark/50 border-osrs-bronze/30 shrink-0 rounded border px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
                    {SEARCH_KIND_LABELS[s.kind]}
                  </span>
                )}
              </button>
            </li>
          ))}
          {suggestions.length === 0 && (
            <li className="text-osrs-parchment-dark/60 px-4 py-3 text-sm">
              No matches — press Enter for full search.
            </li>
          )}
          <li className="border-osrs-bronze/30 border-t">
            <button
              type="button"
              onClick={submit}
              onMouseEnter={() => setActive(-1)}
              className="text-osrs-gold-bright hover:bg-osrs-bronze/10 w-full px-4 py-2.5 text-left text-sm font-medium"
            >
              View all results for “{q.trim()}” →
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
