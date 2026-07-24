"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { EventDetail, EventSignup, EventTeam } from "@droptracker/api-types";
import { getErrorMessage } from "@/lib/errors";
import { Alert, EmptyState, fieldInputClass } from "@/components/ui";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { formatGp, formatRelativeTime } from "@/lib/format";
import {
  assignEventSignup,
  listEventSignups,
  postEventSignupMessage,
  randomizeEventSignups,
  removeEventSignup,
  unassignEventSignup,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";

/** Compact inline <select> style for the per-row team assignment (kept small so
 * it doesn't dominate the row); the filter controls use the shared
 * `fieldInputClass`. */
const teamSelectClass =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-2 py-1 text-sm outline-none disabled:opacity-50";

// A single stable empty array so rows for a clan with no teams keep a constant
// `options` reference (lets the memoized row skip re-renders on filter typing).
const NO_TEAMS: EventTeam[] = [];

// -- Ability-field formatting ------------------------------------------------
// EHB / total level carry an "unknown" state (null EHB = never fetched from
// WOM; total_level 0 = the DB's unknown sentinel) that must read as "—", NOT 0.
const lootValue = (m?: EventSignup["monthly_loot"]) => m?.value ?? 0;
const lootText = (m?: EventSignup["monthly_loot"]) => m?.value_formatted ?? "0";
const fmtEhb = (n: number | null | undefined) =>
  n == null ? null : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const fmtLevel = (n: number | null | undefined) => (n && n > 0 ? n.toLocaleString() : null);

/** A right-aligned numeric cell that renders a muted "—" when the value is
 * unknown, so an admin never mistakes "not fetched yet" for a real 0. */
function StatCell({ value }: { value: string | null }) {
  return (
    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
      {value ?? <span className="text-osrs-parchment-dark/35">—</span>}
    </td>
  );
}

type SortKey = "signup" | "name" | "ehb" | "level" | "loot" | "team";
type SortState = { key: SortKey; dir: "asc" | "desc" };
type StatusFilter = "all" | "unassigned" | "assigned";

const NUMERIC_SORTS: ReadonlySet<SortKey> = new Set(["ehb", "level", "loot", "signup"]);

/** Per-row sort value. `null` = "unknown", which the comparator always pushes to
 * the bottom regardless of direction (an admin sorting by EHB wants the players
 * with a known EHB ranked, not a wall of blanks on top). Team uses -1 for
 * unassigned so "who still needs a team" groups together. */
function sortValue(r: EventSignup, key: SortKey): number | string | null {
  switch (key) {
    case "name":
      return r.player_name.toLowerCase();
    case "ehb":
      return r.ehb ?? null;
    case "level":
      return r.total_level && r.total_level > 0 ? r.total_level : null;
    case "loot":
      return lootValue(r.monthly_loot);
    case "team":
      return r.team_id ?? -1;
    case "signup":
      return r.signed_up_at ?? 0;
  }
}

/** A clickable, accessible sort header. Hoisted out of the parent so its element
 * identity is stable across renders — a header defined inside render remounts
 * every keystroke and throws keyboard focus off the button after a sort. */
const SortableTh = memo(function SortableTh({
  label,
  sortKey,
  align = "left",
  title,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  align?: "left" | "right";
  title?: string;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={title ?? `Sort by ${label.toLowerCase()}`}
        className={`inline-flex items-center gap-1 hover:text-osrs-gold-bright ${
          align === "right" ? "flex-row-reverse" : ""
        } ${active ? "text-osrs-gold-bright" : ""}`}
      >
        {label}
        <span aria-hidden className="text-[10px] opacity-70">
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
});

/** One pool row. Memoized so typing in the filter box (which re-renders the
 * parent) doesn't re-render every visible row — only rows whose props actually
 * change repaint. `options` and the handlers are kept referentially stable by
 * the parent for this to bite. */
const SignupRow = memo(function SignupRow({
  row,
  options,
  pending,
  onAssign,
  onRemove,
}: {
  row: EventSignup;
  options: EventTeam[];
  pending: boolean;
  onAssign: (playerId: number, teamId: number | null) => void;
  onRemove: (playerId: number) => void;
}) {
  const unassigned = row.team_id == null;
  return (
    <tr
      className={`border-osrs-bronze/15 border-t border-l-2 ${
        unassigned ? "border-l-osrs-ember/50" : "border-l-transparent"
      }`}
    >
      <td className="w-full max-w-0 px-3 py-2">
        <div className="flex min-w-0 flex-col">
          <EntityHoverCard
            kind="player"
            id={row.player_id}
            name={row.player_name}
            seed={{ loot: lootText(row.monthly_loot), periodLabel: "this month" }}
            className="flex min-w-0 items-center"
          >
            <Link
              href={`/players/${row.player_id}`}
              className="text-osrs-parchment hover:text-osrs-gold-bright truncate font-medium"
            >
              {row.player_name}
            </Link>
          </EntityHoverCard>
          {(row.group_name || row.source === "discord") && (
            <span className="text-osrs-parchment-dark/50 flex min-w-0 items-center gap-1 text-xs">
              {row.group_name && <span className="truncate">{row.group_name}</span>}
              {row.source === "discord" && <span className="shrink-0">· via Discord</span>}
            </span>
          )}
        </div>
      </td>
      <StatCell value={fmtEhb(row.ehb)} />
      <StatCell value={fmtLevel(row.total_level)} />
      <StatCell value={lootText(row.monthly_loot)} />
      <td className="text-osrs-parchment-dark/60 px-3 py-2 text-right text-xs whitespace-nowrap">
        {row.signed_up_at ? formatRelativeTime(row.signed_up_at) : "—"}
      </td>
      <td className="px-3 py-2">
        <select
          value={row.team_id ?? ""}
          onChange={(e) => onAssign(row.player_id, e.target.value ? Number(e.target.value) : null)}
          disabled={pending || options.length === 0}
          aria-label={`Assign ${row.player_name} to a team`}
          className={teamSelectClass}
        >
          <option value="">Unassigned</option>
          {options.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={() => onRemove(row.player_id)}
          disabled={pending}
          className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 text-xs disabled:opacity-50"
          title="Withdraw this player from the event entirely"
        >
          Remove
        </button>
      </td>
    </tr>
  );
});

/**
 * Admin sign-up tools shown on the event manager:
 *  - "Post sign-up button to Discord" for any self-sign-up event.
 *  - The sign-up pool (formation_mode === "signup_pool"): everyone who opted
 *    in, shown in a sortable / filterable table enriched with each player's
 *    EHB (WOM efficient hours bossed), total level and current-month loot so a
 *    leader can gauge ability at a glance while building teams. Manual team
 *    assignment (and un-assignment back to the pool), a Randomize button
 *    (re-roll as often as you like), and withdrawal are all inline.
 */
export function EventSignupTools({
  groupId,
  event,
  teams,
}: {
  groupId: number | null;
  event: EventDetail;
  teams: EventTeam[];
}) {
  const selfSignup =
    event.formation_mode === "self_join" ||
    event.formation_mode === "auto_assign" ||
    event.formation_mode === "signup_pool";
  const isPool = event.formation_mode === "signup_pool";
  const clanVsClan = event.mode === "clan_vs_clan";

  const [pool, setPool] = useState<EventSignup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // View state (client-side — the whole pool is loaded, so sort/filter is
  // instant even for a few hundred sign-ups).
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [clanFilter, setClanFilter] = useState<number | "all">("all");
  // Default: sign-up order (earliest first), matching the server's ordering —
  // and the "Signed up" column carries the header so the indicator shows and
  // the order stays reachable after sorting by another column.
  const [sort, setSort] = useState<SortState>({ key: "signup", dir: "asc" });

  const eventId = event.id;
  const refresh = useCallback(() => {
    if (!isPool) return;
    listEventSignups(groupId, eventId)
      .then(setPool)
      .catch((err) => setError(getErrorMessage(err, "Couldn't load the sign-up pool.")));
  }, [groupId, eventId, isPool]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleSort = useCallback(
    (key: SortKey) =>
      setSort((prev) =>
        prev.key === key
          ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
          : { key, dir: NUMERIC_SORTS.has(key) ? "desc" : "asc" },
      ),
    [],
  );

  // Eligible teams per clan (clan-vs-clan) precomputed once so each row's
  // `options` prop keeps a stable reference across filter keystrokes.
  const teamsByGroup = useMemo(() => {
    if (!clanVsClan) return null;
    const map = new Map<number | null, EventTeam[]>();
    for (const t of teams) {
      const key = t.group_id ?? null;
      const list = map.get(key);
      if (list) list.push(t);
      else map.set(key, [t]);
    }
    return map;
  }, [teams, clanVsClan]);

  const optionsFor = useCallback(
    (row: EventSignup) =>
      clanVsClan ? teamsByGroup?.get(row.group_id ?? null) ?? NO_TEAMS : teams,
    [clanVsClan, teamsByGroup, teams],
  );

  // Distinct clans present in the pool (for the clan-vs-clan filter).
  const clanOptions = useMemo(() => {
    if (!clanVsClan) return [];
    const seen = new Map<number, string>();
    for (const r of pool ?? []) {
      if (r.group_id != null && !seen.has(r.group_id)) {
        seen.set(r.group_id, r.group_name ?? `Clan ${r.group_id}`);
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [pool, clanVsClan]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (pool ?? []).filter((r) => {
      if (status === "unassigned" && r.team_id != null) return false;
      if (status === "assigned" && r.team_id == null) return false;
      if (clanVsClan && clanFilter !== "all" && r.group_id !== clanFilter) return false;
      if (
        q &&
        !r.player_name.toLowerCase().includes(q) &&
        !(r.group_name ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [pool, query, status, clanFilter, clanVsClan]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    const { key, dir } = sort;
    rows.sort((a, b) => {
      const va = sortValue(a, key);
      const vb = sortValue(b, key);
      const aNull = va == null;
      const bNull = vb == null;
      if (aNull || bNull) return aNull === bNull ? 0 : aNull ? 1 : -1; // unknowns last
      const cmp =
        typeof va === "string"
          ? va.localeCompare(vb as string)
          : (va as number) - (vb as number);
      return dir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [filtered, sort]);

  // Pool-wide summary (from the full pool, not the current filter).
  const stats = useMemo(() => {
    const rows = pool ?? [];
    const ehbKnown = rows.map((r) => r.ehb).filter((v): v is number => v != null);
    return {
      total: rows.length,
      unassigned: rows.filter((r) => r.team_id == null).length,
      avgEhb: ehbKnown.length
        ? Math.round(ehbKnown.reduce((a, b) => a + b, 0) / ehbKnown.length)
        : null,
      poolLoot: rows.reduce((a, r) => a + lootValue(r.monthly_loot), 0),
    };
  }, [pool]);

  const onAssign = useCallback(
    (playerId: number, teamId: number | null) => {
      setError(null);
      startTransition(async () => {
        try {
          // teamId null = the "Unassigned" option → move back to the pool
          // (keep the sign-up); otherwise place on the chosen team.
          if (teamId == null) {
            await unassignEventSignup(groupId, eventId, playerId);
          } else {
            await assignEventSignup(groupId, eventId, playerId, teamId);
          }
          setPool((prev) =>
            (prev ?? []).map((r) => (r.player_id === playerId ? { ...r, team_id: teamId } : r)),
          );
        } catch (err) {
          setError(
            getErrorMessage(
              err,
              teamId == null ? "Couldn't move the player back to the pool." : "Couldn't assign the player.",
            ),
          );
        }
      });
    },
    [groupId, eventId],
  );

  const onRemove = useCallback(
    (playerId: number) => {
      setError(null);
      startTransition(async () => {
        try {
          await removeEventSignup(groupId, eventId, playerId);
          setPool((prev) => (prev ?? []).filter((r) => r.player_id !== playerId));
        } catch (err) {
          setError(getErrorMessage(err, "Couldn't withdraw the player."));
        }
      });
    },
    [groupId, eventId],
  );

  const onRandomize = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await randomizeEventSignups(groupId, eventId);
        setNotice(
          `Shuffled ${res.assigned} player${res.assigned === 1 ? "" : "s"} into teams` +
            (res.unassigned ? ` (${res.unassigned} had no team for their clan)` : "") +
            ".",
        );
        refresh();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't randomize teams."));
      }
    });
  };

  const onPostDiscord = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await postEventSignupMessage(groupId, eventId);
        setNotice("Posted a Sign up button to the event's Discord announcements channel.");
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't post to Discord — is the announcements channel set?"));
      }
    });
  };

  if (!selfSignup) return null;

  const hasFilter = query.trim() !== "" || status !== "all" || clanFilter !== "all";
  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setClanFilter("all");
  };

  return (
    <section className="min-w-0">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="heading-rule text-osrs-gold pb-1 text-lg font-semibold">Sign-ups</h3>
        <button
          onClick={onPostDiscord}
          disabled={pending}
          className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          title="Post an interactive Sign up button to this event's Discord announcements channel"
        >
          Post sign-up to Discord
        </button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {!isPool && (
        <p className="text-osrs-parchment-dark/60 text-sm">
          Players sign up from the event page
          {event.formation_mode === "self_join"
            ? " and pick their own team."
            : " and are auto-assigned to a team."}{" "}
          Switch this event to the <strong>sign-up pool</strong> mode if you&apos;d rather collect
          sign-ups and build the teams yourself.
        </p>
      )}

      {isPool && (
        <div className="space-y-3">
          {/* Action bar + at-a-glance pool summary. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              onClick={onRandomize}
              disabled={pending || !(pool && pool.length) || teams.length === 0}
              className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              title="Randomly distribute everyone in the pool across the teams — re-roll as often as you like"
            >
              🎲 Randomize teams
            </button>
            {pool == null ? (
              <span className="text-osrs-parchment-dark/60 text-xs">Loading…</span>
            ) : (
              <div className="text-osrs-parchment-dark/70 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span>
                  <strong className="text-osrs-parchment">{stats.total}</strong> signed up
                </span>
                <span aria-hidden className="text-osrs-bronze/40">
                  ·
                </span>
                <span className={stats.unassigned ? "text-osrs-ember" : ""}>
                  <strong className={stats.unassigned ? "" : "text-osrs-parchment"}>
                    {stats.unassigned}
                  </strong>{" "}
                  unassigned
                </span>
                {stats.avgEhb != null && (
                  <>
                    <span aria-hidden className="text-osrs-bronze/40">
                      ·
                    </span>
                    <span title="Average EHB across signed-up players with a known EHB">
                      avg <strong className="text-osrs-parchment">{stats.avgEhb.toLocaleString()}</strong> EHB
                    </span>
                  </>
                )}
                {stats.poolLoot > 0 && (
                  <>
                    <span aria-hidden className="text-osrs-bronze/40">
                      ·
                    </span>
                    <span title="Combined current-month loot of the pool">
                      <strong className="text-osrs-parchment">{formatGp(stats.poolLoot)}</strong> pool loot
                    </span>
                  </>
                )}
              </div>
            )}
            {teams.length === 0 && (
              <span className="text-osrs-red/80 text-xs">Create teams first.</span>
            )}
          </div>

          {pool && pool.length > 0 && (
            <>
              {/* Filters: name/clan search, assignment status, and (clan-vs-clan)
                  a per-clan filter. */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by player or clan…"
                  aria-label="Filter sign-ups by player or clan name"
                  className={`${fieldInputClass} min-w-40 flex-1`}
                />
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusFilter)}
                  aria-label="Filter by assignment status"
                  className={fieldInputClass}
                >
                  <option value="all">All players</option>
                  <option value="unassigned">Unassigned only</option>
                  <option value="assigned">Assigned only</option>
                </select>
                {clanVsClan && clanOptions.length > 1 && (
                  <select
                    value={clanFilter}
                    onChange={(e) =>
                      setClanFilter(e.target.value === "all" ? "all" : Number(e.target.value))
                    }
                    aria-label="Filter by clan"
                    className={fieldInputClass}
                  >
                    <option value="all">All clans</option>
                    {clanOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {sorted.length > 0 ? (
                /* The wrapper scrolls horizontally on narrow screens; the player
                   cell (w-full max-w-0) truncates rather than widening the page.
                   min-w on the table keeps the columns legible while scrolling. */
                <div className="border-osrs-bronze/20 overflow-x-auto rounded border">
                  <table className="w-full min-w-[48rem] border-collapse text-sm">
                    <thead>
                      <tr className="text-osrs-gold/80 border-osrs-bronze/20 border-b">
                        <SortableTh label="Player" sortKey="name" sort={sort} onSort={toggleSort} />
                        <SortableTh
                          label="EHB"
                          sortKey="ehb"
                          align="right"
                          title="Efficient Hours Bossed (Wise Old Man) — a proxy for PvM ability"
                          sort={sort}
                          onSort={toggleSort}
                        />
                        <SortableTh
                          label="Total lvl"
                          sortKey="level"
                          align="right"
                          title="Total skill level"
                          sort={sort}
                          onSort={toggleSort}
                        />
                        <SortableTh
                          label="Loot (mo)"
                          sortKey="loot"
                          align="right"
                          title="Total loot tracked this month"
                          sort={sort}
                          onSort={toggleSort}
                        />
                        <SortableTh
                          label="Signed up"
                          sortKey="signup"
                          align="right"
                          title="When the player signed up"
                          sort={sort}
                          onSort={toggleSort}
                        />
                        <SortableTh label="Team" sortKey="team" sort={sort} onSort={toggleSort} />
                        <th className="px-3 py-2" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((row) => (
                        <SignupRow
                          key={row.player_id}
                          row={row}
                          options={optionsFor(row)}
                          pending={pending}
                          onAssign={onAssign}
                          onRemove={onRemove}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-osrs-parchment-dark/60 py-3 text-center text-sm">
                  No players match your filters.
                  {hasFilter && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-osrs-gold hover:text-osrs-gold-bright ml-2 underline"
                    >
                      Clear filters
                    </button>
                  )}
                </p>
              )}
            </>
          )}

          {pool && pool.length === 0 && (
            <EmptyState
              title="No sign-ups yet"
              hint="Players can sign up from the event page, or post a Sign up button to Discord."
            />
          )}
        </div>
      )}
    </section>
  );
}
