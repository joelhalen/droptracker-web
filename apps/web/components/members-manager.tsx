"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { entityPath } from "@/lib/slug";
import type { GroupMember, WomSyncResult } from "@droptracker/api-types";
import { setHidden, syncWom } from "@/app/(site)/(admin)/groups/[id]/members/actions";
import { getErrorMessage } from "@/lib/errors";
import { MAX_LEADERBOARD_QUERY, normalizeQuery } from "@/lib/points-leaderboard";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { Alert, Badge, Button, EmptyState, EntityChip } from "@/components/ui";

/** "in 34 min" / "in 45 sec" — the cooldown is at most an hour. */
function formatCooldown(seconds: number): string {
  if (seconds <= 60) return `${Math.max(seconds, 1)} sec`;
  return `${Math.ceil(seconds / 60)} min`;
}

const SEARCH_DEBOUNCE_MS = 300;

function membersHref(groupId: number, { q, page }: { q?: string; page?: number }): string {
  const qs = new URLSearchParams();
  const query = normalizeQuery(q);
  if (query) qs.set("q", query);
  if (page && page > 1) qs.set("page", String(page));
  const suffix = qs.toString();
  return `/groups/${groupId}/members${suffix ? `?${suffix}` : ""}`;
}

/**
 * Name search for the roster. The list is paged on the backend (sorted by loot
 * over the whole roster), so this drives `?q=` rather than filtering the one
 * page we hold: typing replaces the URL after a short pause and resets to page
 * 1. A plain GET form underneath, so Enter works before hydration too. Same
 * shape as the points leaderboard search.
 */
function MembersSearch({ groupId, initialQuery }: { groupId: number; initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // What the URL currently says, so typing back to it doesn't re-navigate.
  const applied = useRef(normalizeQuery(initialQuery));

  // A `q` change from outside (back button) wins; our own navigations are
  // already in `applied`, so a late re-render can't eat what is being typed.
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
      router.replace(membersHref(groupId, { q }) as Route, { scroll: false });
    });
  };

  const onChange = (next: string) => {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go(next), SEARCH_DEBOUNCE_MS);
  };

  return (
    <form
      role="search"
      action={`/groups/${groupId}/members`}
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        go(value);
      }}
      className="relative w-full sm:w-72"
    >
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
        placeholder="Search members…"
        aria-label="Search members by player name"
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

export function MembersManager({
  groupId,
  members,
  total,
  page = 1,
  limit = 25,
  query = "",
}: {
  groupId: number;
  members: GroupMember[];
  total: number;
  page?: number;
  limit?: number;
  /** Active name search (already normalized); empty = the whole roster. */
  query?: string;
}) {
  const [rows, setRows] = useState(members);
  const [pending, startTransition] = useTransition();
  const [sync, setSync] = useState<WomSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep local rows in sync when the server sends a new page.
  useEffect(() => {
    setRows(members);
  }, [members]);

  const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

  const onSync = () =>
    startTransition(async () => {
      setError(null);
      try {
        setSync(await syncWom(groupId));
      } catch (err) {
        setError(getErrorMessage(err, "WOM sync failed. Please try again."));
      }
    });

  const onToggle = (playerId: number, hidden: boolean) => {
    // Optimistic update with revert on failure.
    setRows((prev) => prev.map((m) => (m.id === playerId ? { ...m, hidden } : m)));
    setError(null);
    startTransition(async () => {
      try {
        await setHidden(groupId, playerId, hidden);
      } catch (err) {
        setRows((prev) => prev.map((m) => (m.id === playerId ? { ...m, hidden: !hidden } : m)));
        setError(getErrorMessage(err, "Couldn't update visibility. Please try again."));
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <MembersSearch groupId={groupId} initialQuery={query} />
          <span className="text-osrs-parchment-dark/70 text-sm">
            {query
              ? `${total} match${total === 1 ? "" : "es"}`
              : `${total} member${total === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {sync &&
            (sync.on_cooldown ? (
              // A cooldown means the request never reached WOM, so "+0 / −0"
              // would read as "your roster is already up to date" — the exact
              // wrong conclusion. Say why nothing happened and when to retry.
              <span className="text-osrs-parchment-dark/70 text-xs">
                Synced recently — try again in {formatCooldown(sync.cooldown_remaining_seconds)}
              </span>
            ) : (
              <span className="text-osrs-green text-xs">
                Synced: +{sync.added} / −{sync.removed} ({sync.total} total)
                {sync.skipped_removals && " — partial roster from WOM, no members removed"}
              </span>
            ))}
          <Button variant="secondary" size="sm" onClick={onSync} disabled={pending}>
            {pending ? "Working…" : "Sync from WOM"}
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-osrs-gold/80 text-left">
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2 text-right">Loot</th>
                <th className="px-3 py-2 text-right">Plugin</th>
                <th className="px-3 py-2 text-right">Visibility</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr
                  key={m.id}
                  className={`border-osrs-bronze/20 border-t ${m.hidden ? "opacity-60" : ""}`}
                >
                  <td className="px-3 py-2">
                    <EntityHoverCard kind="player" id={m.id} name={m.name} className="flex min-w-0">
                      <EntityChip
                        href={entityPath("players", m.id, m.name)}
                        name={m.name}
                        size="sm"
                        playerId={m.id}
                      />
                    </EntityHoverCard>
                  </td>
                  <td className="px-3 py-2">
                    {m.group_rank ? (
                      <Badge variant="bronze">{m.group_rank}</Badge>
                    ) : (
                      <span className="text-osrs-parchment-dark/50">—</span>
                    )}
                  </td>
                  <td className="text-osrs-gold-bright px-3 py-2 text-right tabular-nums">
                    {m.total_loot?.value_formatted ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/groups/${groupId}/members/${m.id}/plugin-config` as Route}
                      className="hover:text-osrs-gold-bright text-xs underline-offset-2 hover:underline"
                      title="How this player's DropTracker plugin is set up"
                    >
                      Settings
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => onToggle(m.id, !m.hidden)}
                      disabled={pending}
                      aria-pressed={m.hidden}
                      className={`rounded px-2 py-1 text-xs ${
                        m.hidden
                          ? "bg-osrs-red/20 text-osrs-red"
                          : "bg-osrs-green/20 text-osrs-green"
                      } disabled:opacity-50`}
                    >
                      {m.hidden ? "Hidden" : "Visible"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : query ? (
        <EmptyState
          title="No matching members"
          hint={`Nobody in this group has "${query}" in their name.`}
        />
      ) : (
        <EmptyState
          title="No members yet"
          hint="Run a WOM sync to pull in your clan's members."
        />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-sm">
          {page > 1 ? (
            <Link
              href={membersHref(groupId, { q: query, page: page - 1 }) as Route}
              className="hover:text-osrs-gold-bright"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-osrs-parchment-dark/70">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={membersHref(groupId, { q: query, page: page + 1 }) as Route}
              className="hover:text-osrs-gold-bright"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
