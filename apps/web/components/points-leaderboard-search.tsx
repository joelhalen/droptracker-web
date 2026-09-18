"use client";

/**
 * Search box for a group's points leaderboard.
 *
 * The board is server-rendered and the search runs on the backend — it has to,
 * because a hit keeps the rank it holds on the FULL board, which one page of
 * rows cannot know. So this only drives the URL: typing replaces `?q=` after a
 * short pause, and the page re-renders around the input (it keeps focus; the
 * component never unmounts). It is a real GET form underneath, so Enter submits
 * at once and it still works before hydration.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { leaderboardHref, MAX_LEADERBOARD_QUERY, normalizeQuery } from "@/lib/points-leaderboard";

const DEBOUNCE_MS = 300;

export function PointsLeaderboardSearch({
  base,
  period,
  initialQuery,
}: {
  /** The group's path in the form the visitor arrived by (slug or id). */
  base: string;
  /** Resolved period token of the board being shown; preserved across searches. */
  period: string;
  initialQuery: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // What the URL currently says, so typing back to it doesn't re-navigate.
  const applied = useRef(normalizeQuery(initialQuery));

  // A navigation that changed `q` from OUTSIDE (back button, a "clear" link)
  // wins over what is in the box. Our own navigations are skipped — `applied`
  // already holds them — or the re-render for "bo" would land while the
  // visitor is typing "bob" and eat the last letter.
  useEffect(() => {
    const incoming = normalizeQuery(initialQuery);
    if (incoming === applied.current) return;
    applied.current = incoming;
    setValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const go = (next: string) => {
    const q = normalizeQuery(next);
    if (q === applied.current) return;
    applied.current = q;
    startTransition(() => {
      router.replace(leaderboardHref(base, { period, q }) as Route, { scroll: false });
    });
  };

  const onChange = (next: string) => {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go(next), DEBOUNCE_MS);
  };

  return (
    <form
      role="search"
      action={`${base}/points/leaderboard`}
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        go(value);
      }}
      className="relative w-full sm:w-72"
    >
      {/* Carried through the no-JS submit so a search keeps its period. */}
      <input type="hidden" name="period" value={period} />
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="text-osrs-parchment-dark/40 pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={MAX_LEADERBOARD_QUERY}
        placeholder="Search players…"
        aria-label="Search this leaderboard by player name"
        autoComplete="off"
        spellCheck={false}
        className={`bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 focus:ring-osrs-gold/60 w-full rounded border py-2 pl-8 pr-8 text-sm focus:outline-none focus:ring-1 [&::-webkit-search-cancel-button]:hidden ${
          pending ? "opacity-70" : ""
        }`}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            if (timer.current) clearTimeout(timer.current);
            setValue("");
            go("");
          }}
          aria-label="Clear search"
          className="text-osrs-parchment-dark/50 hover:text-osrs-gold-bright absolute right-2 top-1/2 -translate-y-1/2 px-1 text-base leading-none"
        >
          ×
        </button>
      )}
    </form>
  );
}
