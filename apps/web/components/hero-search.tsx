"use client";

/**
 * Homepage hero search: a large search field with a debounced typeahead
 * dropdown so visitors can jump straight to a player or clan without leaving
 * the landing page. Suggestions come from the BFF (`/api/search`); submitting
 * falls through to the full `/search` page for complete results.
 */
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { entityPath } from "@/lib/slug";
import { cycleActive } from "@/lib/listbox";
import { useEffect, useRef, useState } from "react";
import type { SearchResults } from "@droptracker/api-types";

const DEBOUNCE_MS = 250;
const MAX_PLAYERS = 5;
const MAX_GROUPS = 4;
const MAX_ENTITIES = 3;

type Suggestion = {
  key: string;
  href: Route;
  name: string;
  kind: "Player" | "Clan" | "Boss" | "Item";
  detail: string | null;
};

function toSuggestions(results: SearchResults): Suggestion[] {
  const players = results.players.slice(0, MAX_PLAYERS).map(
    (p): Suggestion => ({
      key: `p-${p.id}`,
      href: entityPath("players", p.id, p.name),
      name: p.name,
      kind: "Player",
      detail: p.global_rank != null ? `Global rank #${p.global_rank}` : null,
    }),
  );
  const groups = results.groups.slice(0, MAX_GROUPS).map(
    (g): Suggestion => ({
      key: `g-${g.id}`,
      href: entityPath("groups", g.id, g.name),
      name: g.name,
      kind: "Clan",
      detail:
        g.member_count != null
          ? `${g.member_count} member${g.member_count === 1 ? "" : "s"}`
          : null,
    }),
  );
  const npcs = (results.npcs ?? []).slice(0, MAX_ENTITIES).map(
    (n): Suggestion => ({
      key: `n-${n.id}`,
      href: entityPath("npcs", n.id, n.name),
      name: n.name,
      kind: "Boss",
      detail: null,
    }),
  );
  const items = (results.items ?? []).slice(0, MAX_ENTITIES).map(
    (i): Suggestion => ({
      key: `i-${i.id}`,
      href: entityPath("items", i.id, i.name),
      name: i.name,
      kind: "Item",
      detail: null,
    }),
  );
  return [...players, ...groups, ...npcs, ...items];
}

export function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Debounced typeahead lookup. Stale responses are dropped by the cleanup
  // flag so fast typing can't reorder results.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
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
          setSuggestions(toSuggestions(results));
          setActive(-1);
          setSearched(true);
          setOpen(true);
        })
        .catch(() => {
          /* best-effort — Enter still goes to /search */
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  // Close the dropdown when clicking anywhere outside the component.
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

  const submit = () => {
    const query = q.trim();
    if (!query) return;
    if (active >= 0 && suggestions[active]) go(suggestions[active].href);
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

  const showDropdown = open && q.trim().length >= 2 && searched;

  return (
    <div ref={rootRef} className="relative max-w-xl">
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
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => searched && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Find a player, clan, boss or item…"
            aria-label="Search players, clans, bosses and items"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="hero-search-listbox"
            aria-autocomplete="list"
            autoComplete="off"
            className="border-osrs-bronze/50 bg-osrs-brown-dark/60 focus:border-osrs-gold placeholder:text-osrs-parchment-dark/50 w-full rounded-lg border py-3 pr-3 pl-9 text-base outline-none backdrop-blur-sm"
          />
        </div>
        <button
          type="submit"
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded-lg px-5 py-3 text-sm font-semibold transition-colors"
        >
          Search
        </button>
      </form>

      {showDropdown && (
        <ul
          id="hero-search-listbox"
          role="listbox"
          className="border-osrs-bronze/40 bg-osrs-surface-2 shadow-osrs-pop absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-lg border"
        >
          {suggestions.map((s, i) => (
            <li key={s.key} role="option" aria-selected={i === active}>
              <button
                type="button"
                onClick={() => go(s.href)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm ${
                  i === active ? "bg-osrs-bronze/20" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="text-osrs-parchment block truncate font-medium">{s.name}</span>
                  {s.detail && (
                    <span className="text-osrs-parchment-dark/60 block truncate text-xs">
                      {s.detail}
                    </span>
                  )}
                </span>
                <span className="text-osrs-parchment-dark/50 border-osrs-bronze/30 shrink-0 rounded border px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
                  {s.kind}
                </span>
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
