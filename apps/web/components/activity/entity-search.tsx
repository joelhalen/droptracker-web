"use client";

/**
 * Live search for the Discord Activity — the counterpart to the site's
 * `components/entity-search.tsx`, sharing its shaping via
 * `lib/search-suggestions.ts` so the two surfaces can't drift on which hits
 * they show or how they describe them.
 *
 * Two deliberate differences from the site:
 *
 *  - Results render INLINE, replacing whatever the screen was showing, rather
 *    than in a floating dropdown. The activity is a short iframe with its own
 *    bottom tab bar; an absolutely-positioned panel gets clipped by the scroll
 *    container and lands under the tab bar on the narrow (mobile) layout.
 *  - Picking a hit pushes onto the nav stack instead of routing to a URL.
 *    Site routes don't exist in here, so there is no "see all results" page to
 *    fall through to — the list on screen IS the whole result.
 *
 * Composition: children are the screen's normal content, shown whenever the
 * search box is idle. That keeps the caller from having to mirror the
 * "is the user searching?" condition itself.
 */
import { useEffect, useState } from "react";
import { searchAll } from "@/lib/activity/api";
import { openExternal } from "@/lib/activity/discord-sdk";
import { useActivityNav } from "@/lib/activity/nav";
import { Card, NameTile } from "@/components/ui";
import { EmptyNote, ErrorNote, LoadingBlock, PressRow } from "@/components/activity/bits";
import {
  MIN_SEARCH_LENGTH,
  SEARCH_DEBOUNCE_MS,
  SEARCH_KIND_LABELS,
  toSuggestions,
  type SearchKind,
  type Suggestion,
} from "@/lib/search-suggestions";

/** Players and groups have a view in here (nav.tsx); bosses and items don't,
 *  so those open on the site outside the iframe and say so in the row. */
const NAVIGABLE: SearchKind[] = ["players", "groups"];
const SITE_ORIGIN = "https://www.droptracker.io";

export function ActivitySearch({
  kinds,
  placeholder,
  children,
}: {
  kinds: readonly SearchKind[];
  placeholder: string;
  children?: React.ReactNode;
}) {
  const nav = useActivityNav();
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const query = q.trim();
  const searching = query.length >= MIN_SEARCH_LENGTH;
  const kindsKey = kinds.join(",");

  // Debounced lookup; the cancel flag drops stale responses so fast typing
  // can't reorder results.
  useEffect(() => {
    if (query.length < MIN_SEARCH_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      setFailed(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const timer = setTimeout(() => {
      searchAll(query)
        .then((results) => {
          if (cancelled) return;
          setSuggestions(toSuggestions(results, kindsKey.split(",") as SearchKind[]));
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setFailed(true);
          setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, kindsKey]);

  const pick = (s: Suggestion) => {
    if (s.kind === "players") nav.push({ name: "player", id: s.id });
    else if (s.kind === "groups") nav.push({ name: "group", id: s.id });
    else void openExternal(`${SITE_ORIGIN}/${s.kind}/${s.id}`);
  };

  return (
    <div>
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          // `search` gets the on-screen keyboard a Search key and, on iOS, a
          // native clear affordance alongside our own button.
          type="search"
          enterKeyHint="search"
          className="border-osrs-bronze/40 bg-osrs-surface-1 focus:border-osrs-gold text-osrs-parchment placeholder:text-osrs-parchment-dark/40 w-full rounded-xl border py-2 pr-9 pl-3.5 text-sm outline-none"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="text-osrs-parchment-dark/50 hover:text-osrs-gold-bright absolute top-1/2 right-1 size-7 -translate-y-1/2 text-base leading-none"
          >
            ✕
          </button>
        )}
      </div>

      <div className="mt-2.5">
        {!searching ? (
          children
        ) : failed ? (
          <ErrorNote>Couldn&apos;t search just now — try again shortly.</ErrorNote>
        ) : loading ? (
          <LoadingBlock rows={4} />
        ) : suggestions.length === 0 ? (
          <EmptyNote>No matches for “{query}”.</EmptyNote>
        ) : (
          <Card padding="p-0">
            {suggestions.map((s) => {
              const leavesIframe = !NAVIGABLE.includes(s.kind);
              return (
                <div key={s.key} className="border-osrs-bronze/20 border-b last:border-b-0">
                  <PressRow
                    name={s.name}
                    icon={
                      s.iconUrl ? (
                        <img
                          src={s.iconUrl}
                          alt=""
                          className="size-8 shrink-0 object-contain"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                          }}
                        />
                      ) : (
                        <NameTile name={s.name} size="sm" />
                      )
                    }
                    subtitle={s.detail ?? undefined}
                    right={
                      // Only badge the kind when the list actually mixes them —
                      // a column of identical "Player" chips is just noise. A
                      // row that leaves the iframe says so instead, so nobody
                      // taps a boss expecting to stay put.
                      kinds.length > 1 ? (
                        <span className="text-osrs-parchment-dark/45 border-osrs-bronze/30 rounded border px-1.5 py-0.5 text-[10px] tracking-wide uppercase">
                          {leavesIframe ? "Site ↗" : SEARCH_KIND_LABELS[s.kind]}
                        </span>
                      ) : undefined
                    }
                    onPress={() => pick(s)}
                  />
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
