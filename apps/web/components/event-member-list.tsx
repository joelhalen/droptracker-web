"use client";

/**
 * Searchable, paginated member list — the antidote to "endless scroll" on
 * events with huge teams (a clan-vs-clan event can materialize 400+ member
 * rosters). Data is already in the page payload, so search + pagination are
 * purely client-side; no new fetch. The row markup is caller-owned via
 * `renderRow`, so the same primitive serves the event page aside, the team
 * page roster, and the admin team editor.
 */
import { useMemo, useState, type ReactNode } from "react";

type BaseMember = { player_id: number; player_name: string };

/** Compact search box (magnifier + clear), matching the points-manager style. */
function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <svg
        viewBox="0 0 24 24"
        className="text-osrs-parchment-dark/40 pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 focus:ring-osrs-gold/60 w-full rounded border py-2 pr-8 pl-8 text-sm focus:ring-1 focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="text-osrs-parchment-dark/50 hover:text-osrs-gold absolute top-1/2 right-2 -translate-y-1/2"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** Prev/next pager with a result-count summary. */
function Pager({
  page,
  totalPages,
  onPage,
  summary,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  summary: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-osrs-parchment-dark/50 text-xs">{summary}</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            className="text-osrs-gold-bright disabled:text-osrs-parchment-dark/30 hover:underline"
          >
            ← Prev
          </button>
          <span className="text-osrs-parchment-dark/60">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= totalPages}
            className="text-osrs-gold-bright disabled:text-osrs-parchment-dark/30 hover:underline"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export function EventMemberList<M extends BaseMember>({
  members,
  renderRow,
  pageSize = 8,
  listClassName = "space-y-2",
  searchPlaceholder = "Search players…",
  unit = "player",
  emptyLabel = "No members yet.",
}: {
  members: M[];
  /** Row renderer; must return an `<li>` with a stable `key`. */
  renderRow: (member: M) => ReactNode;
  pageSize?: number;
  /** Class on the wrapping `<ul>` (controls row spacing/dividers). */
  listClassName?: string;
  searchPlaceholder?: string;
  /** Singular noun for the count summary ("player", "member"). */
  unit?: string;
  emptyLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const q = query.trim().toLowerCase();

  const filtered = useMemo(
    () => (q ? members.filter((m) => m.player_name.toLowerCase().includes(q)) : members),
    [members, q],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * pageSize, current * pageSize);
  // Search only earns its space once the list outgrows a single page.
  const showSearch = members.length > pageSize;

  if (!members.length) {
    return <p className="text-osrs-parchment-dark/50 text-sm">{emptyLabel}</p>;
  }

  const changeQuery = (v: string) => {
    setQuery(v);
    setPage(1);
  };

  const plural = (n: number) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  const summary = q ? `${filtered.length} of ${plural(members.length)}` : plural(members.length);

  return (
    <div className="space-y-2">
      {showSearch && (
        <SearchInput value={query} onChange={changeQuery} placeholder={searchPlaceholder} />
      )}
      {rows.length ? (
        <ul className={listClassName}>{rows.map((m) => renderRow(m))}</ul>
      ) : (
        <p className="text-osrs-parchment-dark/50 text-sm">No players match “{query}”.</p>
      )}
      {(showSearch || totalPages > 1) && (
        <Pager page={current} totalPages={totalPages} onPage={setPage} summary={summary} />
      )}
    </div>
  );
}
