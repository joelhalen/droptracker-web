"use client";

/**
 * Docs sidebar search: a typeahead over every docs page's title, headings and
 * body text (BFF `/api/docs/search` → Web API `/docs/search`). Each hit opens
 * the page at its best-matching section and shows a snippet with the matched
 * words highlighted, so a reader can tell it's the right place before
 * clicking. Enter opens the highlighted hit, or the first one.
 */
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { DocSearchHit } from "@/lib/api/types";
import { docHitHref, highlightRuns } from "@/lib/docs";
import { cycleActive } from "@/lib/listbox";
import { MIN_SEARCH_LENGTH, SEARCH_DEBOUNCE_MS } from "@/lib/search-suggestions";

function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightRuns(text, query).map((run, i) =>
        run.hit ? (
          <mark key={i} className="text-osrs-gold-bright bg-transparent font-semibold">
            {run.text}
          </mark>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </>
  );
}

export function DocsSearch() {
  const router = useRouter();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<DocSearchHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const query = q.trim();
    if (query.length < MIN_SEARCH_LENGTH) {
      setHits([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/docs/search?q=${encodeURIComponent(query)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((rows: DocSearchHit[]) => {
          if (cancelled) return;
          setHits(rows);
          setActive(-1);
          setSearched(true);
          setOpen(true);
        })
        .catch(() => {
          /* best-effort */
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const go = (hit: DocSearchHit) => {
    setOpen(false);
    setQ("");
    router.push(docHitHref(hit) as Route);
  };

  const showDropdown = open && searched && q.trim().length >= MIN_SEARCH_LENGTH;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!hits.length) return;
      setOpen(true);
      setActive((prev) => cycleActive(prev, e.key === "ArrowDown" ? 1 : -1, hits.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[active >= 0 ? active : 0];
      if (hit) go(hit);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div role="search" className="relative">
        <span
          aria-hidden
          className="text-osrs-parchment-dark/50 pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
        >
          ⌕
        </span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => searched && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search the docs"
          aria-label="Search the docs"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          className="border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold placeholder:text-osrs-parchment-dark/50 w-full rounded-lg border py-1.5 pr-2 pl-7 text-sm outline-none"
        />
      </div>

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          className="card-pop menu-in absolute top-full left-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden"
        >
          {hits.map((hit, i) => (
            <li key={hit.slug} role="option" aria-selected={i === active}>
              <button
                type="button"
                onClick={() => go(hit)}
                onMouseEnter={() => setActive(i)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  i === active ? "bg-osrs-bronze/20" : ""
                }`}
              >
                <span className="text-osrs-parchment block truncate font-medium">
                  {hit.title}
                  {hit.section && (
                    <span className="text-osrs-parchment-dark/60 font-normal">
                      {" "}
                      › {hit.section}
                    </span>
                  )}
                </span>
                {hit.snippet && (
                  <span className="text-osrs-parchment-dark/70 line-clamp-2 text-xs">
                    <Highlighted text={hit.snippet} query={q} />
                  </span>
                )}
              </button>
            </li>
          ))}
          {hits.length === 0 && (
            <li className="text-osrs-parchment-dark/60 px-3 py-3 text-sm">
              Nothing in the docs matches that. Try fewer words, or ask in our Discord.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
