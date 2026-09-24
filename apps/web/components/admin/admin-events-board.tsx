"use client";

import { useMemo, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import type { EventSummary } from "@droptracker/api-types";
import {
  ADMIN_EVENT_BUCKETS,
  adminEventBucket,
  countAdminEvents,
  filterAdminEvents,
  type AdminEventBucket,
  type AdminEventFilters,
  type AdminEventScope,
} from "@/lib/events";
import { eventTypeLabel, liveProgress } from "@/lib/event-timeline";
import { EmptyState, Input, Select } from "@/components/ui";
import { EventWindow } from "@/components/local-time";

/** How many rows a tab shows before "Show more" (past events pile up). */
const PAGE = 25;

const BUCKET_META: Record<AdminEventBucket, { label: string; hint: string }> = {
  live: { label: "Live", hint: "Running now" },
  upcoming: { label: "Upcoming", hint: "Start on their own" },
  attention: { label: "Needs attention", hint: "Start date passed, still not live" },
  draft: { label: "Drafts", hint: "No start date yet" },
  past: { label: "Past", hint: "Ended" },
};

const BUCKET_CHIP: Record<AdminEventBucket, string> = {
  live: "bg-green-500/15 text-green-400",
  upcoming: "bg-osrs-gold/15 text-osrs-gold",
  attention: "bg-osrs-ember/15 text-osrs-ember",
  draft: "bg-osrs-bronze/20 text-osrs-parchment-dark/80",
  past: "bg-osrs-brown-dark/60 text-osrs-parchment-dark/50",
};

function manageHref(e: EventSummary): Route {
  return (
    e.group_id == null ? `/admin/events/${e.id}` : `/groups/${e.group_id}/events/${e.id}`
  ) as Route;
}

function setupHref(e: EventSummary): Route {
  return (
    e.group_id == null
      ? `/admin/events/new?event=${e.id}`
      : `/groups/${e.group_id}/events/new?event=${e.id}`
  ) as Route;
}

/** The tab to open on: whatever needs looking at first. */
function defaultBucket(counts: Record<AdminEventBucket, number>): AdminEventBucket | "all" {
  if (counts.attention) return "attention";
  if (counts.live) return "live";
  if (counts.upcoming) return "upcoming";
  if (counts.draft) return "draft";
  return "all";
}

/**
 * Staff overview of every event on the site: tabs by where each event is in
 * its life (live, upcoming, stuck, draft, past), a search and filters, and one
 * row per event with its owner, dates, roster size and the next action.
 */
export function AdminEventsBoard({ events, nowSec }: { events: EventSummary[]; nowSec: number }) {
  const counts = useMemo(() => countAdminEvents(events, nowSec), [events, nowSec]);
  const [filters, setFilters] = useState<AdminEventFilters>(() => ({
    bucket: defaultBucket(counts),
    scope: "all",
    kind: "all",
    query: "",
  }));
  const [limit, setLimit] = useState(PAGE);

  const kinds = useMemo(() => [...new Set(events.map((e) => e.kind))].sort(), [events]);
  const rows = useMemo(() => filterAdminEvents(events, filters, nowSec), [events, filters, nowSec]);
  const visible = rows.slice(0, limit);

  const set = (patch: Partial<AdminEventFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setLimit(PAGE);
  };

  const tabs: (AdminEventBucket | "all")[] = [
    ...ADMIN_EVENT_BUCKETS.filter((b) => b !== "attention" || counts.attention > 0),
    "all",
  ];

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" role="tablist">
        {tabs.map((b) => {
          const selected = filters.bucket === b;
          const label = b === "all" ? "All" : BUCKET_META[b].label;
          const hint = b === "all" ? "Every event" : BUCKET_META[b].hint;
          const count = b === "all" ? events.length : counts[b];
          return (
            <button
              key={b}
              role="tab"
              aria-selected={selected}
              onClick={() => set({ bucket: b })}
              className={`min-w-0 rounded-lg border px-3 py-2 text-left transition-colors ${
                selected
                  ? "border-osrs-gold bg-osrs-gold/10"
                  : "border-osrs-bronze/30 bg-osrs-surface-2/60 hover:border-osrs-gold/60"
              }`}
            >
              <span
                className={`block text-xs uppercase tracking-wide ${
                  b === "attention" ? "text-osrs-ember" : "text-osrs-parchment-dark/60"
                }`}
              >
                {label}
              </span>
              <span className="text-osrs-gold-bright block text-2xl font-bold tabular-nums">
                {count}
              </span>
              <span className="text-osrs-parchment-dark/50 block truncate text-xs">{hint}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          fieldSize="sm"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="Search by event, group or id…"
          aria-label="Search events"
          className="min-w-0 flex-1 sm:max-w-xs"
        />
        <Select
          fieldSize="sm"
          value={filters.scope}
          onChange={(e) => set({ scope: e.target.value as AdminEventScope })}
          aria-label="Filter by owner"
        >
          <option value="all">Global and group events</option>
          <option value="global">Global events</option>
          <option value="group">Group events</option>
        </Select>
        <Select
          fieldSize="sm"
          value={filters.kind}
          onChange={(e) => set({ kind: e.target.value as AdminEventFilters["kind"] })}
          aria-label="Filter by format"
        >
          <option value="all">Every format</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {eventTypeLabel({ kind: k, has_bingo: k === "bingo" })}
            </option>
          ))}
        </Select>
        <span className="text-osrs-parchment-dark/50 ml-auto text-xs">
          {rows.length} {rows.length === 1 ? "event" : "events"}
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No events here"
          hint={
            events.length
              ? "Nothing matches these filters."
              : "Create a global event, or check back once groups start running theirs."
          }
        />
      ) : (
        <ul className="divide-osrs-bronze/15 border-osrs-bronze/25 divide-y rounded-lg border">
          {visible.map((e) => (
            <EventRow key={e.id} event={e} nowSec={nowSec} />
          ))}
        </ul>
      )}

      {rows.length > visible.length && (
        <button
          onClick={() => setLimit((n) => n + PAGE)}
          className="text-osrs-gold-bright text-sm hover:underline"
        >
          Show {Math.min(PAGE, rows.length - visible.length)} more
        </button>
      )}
    </div>
  );
}

function EventRow({ event: e, nowSec }: { event: EventSummary; nowSec: number }) {
  const bucket = adminEventBucket(e, nowSec);
  const progress = bucket === "live" ? liveProgress(e, nowSec) : null;
  const clanVsClan = e.mode === "clan_vs_clan";
  const teams = e.team_count ?? 0;
  const players = e.player_count ?? 0;

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link
            href={manageHref(e)}
            className="hover:text-osrs-gold-bright min-w-0 truncate font-medium"
          >
            {e.name}
          </Link>
          <span
            className={`${BUCKET_CHIP[bucket]} rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide`}
          >
            {BUCKET_META[bucket].label}
          </span>
          <span className="bg-osrs-bronze/15 text-osrs-parchment-dark/70 rounded px-1.5 py-0.5 text-[11px]">
            {eventTypeLabel(e)}
          </span>
          {clanVsClan && (
            <span className="bg-osrs-bronze/15 text-osrs-parchment-dark/70 rounded px-1.5 py-0.5 text-[11px]">
              Clan vs clan
            </span>
          )}
          {e.visibility === "private" && (
            <span className="bg-osrs-bronze/15 text-osrs-parchment-dark/70 rounded px-1.5 py-0.5 text-[11px]">
              Private
            </span>
          )}
        </div>
        <p className="text-osrs-parchment-dark/60 text-xs">
          {e.group_id == null ? (
            <span className="text-osrs-gold/90">
              {e.staff_hosted ? "Global, run by staff" : "Global"}
            </span>
          ) : (
            <Link href={`/groups/${e.group_id}` as Route} className="hover:text-osrs-gold-bright">
              {e.group_name ?? `Group #${e.group_id}`}
            </Link>
          )}
          <span aria-hidden className="text-osrs-bronze/50">
            {" · "}
          </span>
          <EventWindow startsAt={e.starts_at} endsAt={e.ends_at} status={e.status} />
        </p>
        <p className="text-osrs-parchment-dark/50 text-xs">
          {teams} {teams === 1 ? "team" : "teams"} · {players}{" "}
          {players === 1 ? "player" : "players"}
          {bucket === "attention" && (
            <span className="text-osrs-ember">
              {" · "}goes live as soon as its setup is finished
            </span>
          )}
          {bucket === "draft" && " · won't start until someone launches it"}
        </p>
        {progress != null && (
          <div
            className="bg-osrs-brown-dark/60 h-1 w-40 max-w-full overflow-hidden rounded"
            title={`${Math.round(progress * 100)}% through`}
          >
            <div className="h-full bg-green-500/70" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs">
        {e.status === "draft" && (
          <Link href={setupHref(e)} className="text-osrs-gold-bright hover:underline">
            {bucket === "attention" ? "Fix setup" : "Continue setup"}
          </Link>
        )}
        <Link href={manageHref(e)} className="text-osrs-gold-bright hover:underline">
          Manage
        </Link>
        <Link
          href={`/events/${e.id}` as Route}
          className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright hover:underline"
        >
          View page
        </Link>
      </div>
    </li>
  );
}
