"use client";

/**
 * A team's submission log (t62) — the "who got what, when" view manual-
 * submission events used to give for free, rebuilt on the applied ledger.
 *
 * Two visual tiers, deliberately: a **contribution** (an item, a pet, a PB, a
 * scoring row, an organizer's award) gets a full line with its item icon, the
 * points it credited and its screenshot thumbnail; a **progress rollup** — the
 * ticks a kc/xp/GP task mints per kill or drop, already folded server-side into
 * one line per (player, task) — gets a single muted row. That is the whole
 * point of the endpoint: the old "Recent activity" feed listed every tick and
 * buried the drops people actually want to see.
 *
 * Fetched client-side and paginated, so it never inflates the team payload.
 * The site hits its cookie BFF by default; the Discord Activity passes
 * `loadPage` because cookies don't survive the discordsays iframe.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { EventTeamContribution, EventTeamContributions } from "@droptracker/api-types";
import { entityPath } from "@/lib/slug";
import { contributionSummary } from "@/lib/events";
import { formatRelativeTime } from "@/lib/format";
import { ItemDbIcon } from "@/components/item-db-icon";
import { EmptyState } from "@/components/ui";

/** Points, 2-dp max with trailing zeros stripped ("2.5", "12"). */
const fmtPoints = (p: number) => (Math.round(p * 100) / 100).toLocaleString();

/** A rolled-up run of metric ticks rather than a discrete acquisition. */
const isRollup = (e: EventTeamContribution) => (e.collapsed ?? 0) > 1;

/** How the organizer's action reads next to the player's name. */
const verb = (e: EventTeamContribution) =>
  e.source_type === "manual" ? "was awarded" : e.source_type === "bonus" ? "earned" : "got";

/** What the row is ABOUT, in a few words. The item name wins when there is
 * one; an award has no item and no meaningful quantity, so it reads as the
 * task itself; otherwise `contributionSummary` prices the quantity the way the
 * task type means it ("14 kills", "1.20M gp"). */
function subject(e: EventTeamContribution): string {
  if (e.matched_target) {
    return e.quantity > 1
      ? `${e.matched_target} ×${e.quantity.toLocaleString()}`
      : e.matched_target;
  }
  if (e.source_type === "manual" || e.source_type === "bonus") {
    return e.task_label ?? `task ${e.task_id}`;
  }
  return contributionSummary(e);
}

export function EventTeamContributionLog({
  eventId,
  teamId,
  refreshKey = 0,
  loadPage,
  onOpenPlayer,
}: {
  eventId: number;
  teamId: number;
  /** Bump to refetch the current page in place — the team view raises it on
   * every completion frame so a live line arrives without a reload. */
  refreshKey?: number;
  /** Discord Activity: bearer-authed loader (its iframe has no cookies).
   * Omitted on the site, which uses the same-origin cookie BFF. */
  loadPage?: (page: number) => Promise<EventTeamContributions>;
  /** Discord Activity: swaps player links for in-app view pushes. */
  onOpenPlayer?: (playerId: number) => void;
}) {
  const [data, setData] = useState<EventTeamContributions | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The loader lives in a ref so a caller that rebuilds the closure every
  // render (the Activity view does) can't retrigger the fetch effect.
  const loaderRef = useRef(loadPage);
  useEffect(() => {
    loaderRef.current = loadPage;
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const load = loaderRef.current
      ? loaderRef.current(page)
      : fetch(`/api/events/${eventId}/teams/${teamId}/contributions?page=${page}`, {
          cache: "no-store",
        }).then(async (res) => {
          if (!res.ok) throw new Error(`Failed to load (${res.status})`);
          return (await res.json()) as EventTeamContributions;
        });
    load
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Couldn't load the submission log.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, teamId, page, refreshKey]);

  const meta = data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / Math.max(1, meta.limit))) : 1;
  const rollups = data?.entries.filter(isRollup).length ?? 0;

  const who = (e: EventTeamContribution) => {
    const fallback = e.source_type === "manual" ? "Admin award" : "Team";
    if (e.player_id == null || !e.player_name) {
      return (
        <span className={e.hidden ? "text-osrs-parchment-dark/50 italic" : "text-osrs-parchment"}>
          {e.player_name ?? fallback}
        </span>
      );
    }
    return onOpenPlayer ? (
      <button
        type="button"
        onClick={() => onOpenPlayer(e.player_id!)}
        className="text-osrs-parchment hover:text-osrs-gold-bright font-medium"
      >
        {e.player_name}
      </button>
    ) : (
      <Link
        href={entityPath("players", e.player_id, e.player_name)}
        className="text-osrs-parchment hover:text-osrs-gold-bright font-medium"
      >
        {e.player_name}
      </Link>
    );
  };

  return (
    <div className="space-y-3">
      {meta && meta.total > 0 && (
        <div className="text-osrs-parchment-dark/50 flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="tabular-nums">{meta.total.toLocaleString()} entries</span>
          {meta.folded_updates > 0 && (
            <span title="Kill-count, XP and GP tasks post an update per kill or drop; those are rolled up per player so they don't bury the drops.">
              · {meta.folded_updates.toLocaleString()} progress update
              {meta.folded_updates === 1 ? "" : "s"} rolled into {rollups.toLocaleString()} line
              {rollups === 1 ? "" : "s"}
            </span>
          )}
          {meta.truncated && <span>· older entries live in the event&apos;s completions tab</span>}
        </div>
      )}

      {error && <div className="text-osrs-red text-sm">{error}</div>}

      {loading && !data ? (
        <div className="text-osrs-parchment-dark/60 p-6 text-center text-sm">Loading…</div>
      ) : !data || data.entries.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          hint="Qualifying drops, kills and records will show up here as the team plays."
        />
      ) : (
        <ul className="divide-osrs-bronze/15 divide-y">
          {data.entries.map((e) =>
            isRollup(e) ? (
              <li
                key={e.completion_id}
                className="text-osrs-parchment-dark/60 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5 text-xs"
              >
                <span className="min-w-0 break-words">
                  {who(e)} <span>advanced</span>{" "}
                  <span className="text-osrs-parchment-dark/80">
                    {e.task_label ?? `task ${e.task_id}`}
                  </span>{" "}
                  — {contributionSummary(e)}
                  <span className="text-osrs-parchment-dark/40">
                    {" "}
                    over {e.collapsed!.toLocaleString()} updates
                  </span>
                </span>
                <span className="text-osrs-parchment-dark/40 shrink-0">
                  {formatRelativeTime(e.created_at ?? 0)}
                </span>
              </li>
            ) : (
              <li key={e.completion_id} className="flex min-w-0 gap-3 py-2.5">
                <span className="mt-0.5 shrink-0">
                  {e.item_id != null ? (
                    <ItemDbIcon itemId={e.item_id} size={28} />
                  ) : (
                    <span className="bg-osrs-surface-2/50 text-osrs-parchment-dark/40 flex size-7 items-center justify-center rounded text-xs">
                      ★
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                    <span className="min-w-0 break-words">
                      {who(e)} <span className="text-osrs-parchment-dark/60">{verb(e)}</span>{" "}
                      <span className="text-osrs-parchment">{subject(e)}</span>
                    </span>
                    <span className="flex shrink-0 items-baseline gap-2">
                      {e.points > 0 && (
                        <span className="text-osrs-gold-bright text-sm font-semibold tabular-nums">
                          +{fmtPoints(e.points)}
                        </span>
                      )}
                      <span className="text-osrs-parchment-dark/40 text-xs">
                        {formatRelativeTime(e.created_at ?? 0)}
                      </span>
                    </span>
                  </div>
                  <div className="text-osrs-parchment-dark/50 mt-0.5 text-xs break-words">
                    {/* The task only repeats itself on an award row, where it
                        already IS the subject. */}
                    {subject(e) === e.task_label ? null : (e.task_label ?? `task ${e.task_id}`)}
                    {e.note && <span className="italic"> — “{e.note}”</span>}
                  </div>
                  {e.proof_url && (
                    <a
                      href={e.proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 block max-w-xs"
                      title="Open screenshot"
                    >
                      <img
                        src={e.proof_url}
                        alt={`Screenshot of ${e.matched_target ?? e.task_label ?? "submission"}`}
                        loading="lazy"
                        className="border-osrs-bronze/25 hover:border-osrs-gold/50 h-24 w-full rounded-md border object-cover"
                        onError={(ev) =>
                          ((ev.currentTarget as HTMLImageElement).style.display = "none")
                        }
                      />
                    </a>
                  )}
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {meta && totalPages > 1 && (
        <div className="text-osrs-parchment-dark/60 flex items-center justify-between text-sm">
          <span>
            Page {meta.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
