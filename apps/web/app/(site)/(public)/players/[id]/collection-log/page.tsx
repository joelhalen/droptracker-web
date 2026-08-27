/**
 * A player's collection log, browsed as it is in game.
 *
 * The structure (which slots exist, and how they group into tabs and pages)
 * comes from the OSRS Wiki via scripts/sync_collection_log.py, so this can show
 * unobtained slots too — which is most of what a collection log is.
 *
 * The sync that writes this ships with plugin v6, published 2026-08-24, so it
 * populates for anyone who has updated. `lib/plugin-features.ts` still carries
 * the release flag and the copy an unreachable panel would show.
 *
 * Two counts are deliberately kept apart. `slots` is what the game itself
 * reports the player has filled; `obtained` is what we can account for against
 * the structure. They differ until the player opens their log in game (which
 * triggers a full read), and pretending otherwise would make the page look
 * wrong rather than incomplete.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { resolveRef } from "@/lib/entity-ref";
import { EmptyState } from "@/components/ui";
import { OsrsWindow, completionTone } from "@/components/osrs-panel";
import { CollectionLogBrowser } from "@/components/collection-log-browser";
import { stateSyncEmpty } from "@/lib/plugin-features";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ref = await resolveRef("player", id);
  if (!("id" in ref) || ref.id == null) return { title: "Collection log" };
  try {
    const player = await api.player(ref.id);
    return {
      title: `${player.name} — Collection log`,
      description: `Collection log progress for ${player.name}.`,
    };
  } catch {
    return { title: "Collection log" };
  }
}

export default async function CollectionLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ref = await resolveRef("player", id);
  if (!("id" in ref) || ref.id == null) notFound();
  const playerId = ref.id;

  const player = await orNotFound(api.player(playerId));
  const log = await api.playerCollectionLog(playerId).catch(() => null);

  if (!log || !log.has_synced) {
    return (
      <div className="space-y-6">
        <Header name={player.name} playerId={playerId} />
        <EmptyState
          {...stateSyncEmpty(
            "Collection log",
            `${player.name} has not synced their account progress. It records here once they are on DropTracker plugin v6 and open the collection log in game — "Sync account progress" is on by default, under Advanced.`,
          )}
        />
      </div>
    );
  }

  // Prefer the game's own count for the headline: it is right even when our
  // structure or item table lags a game update.
  const filled = log.slots ?? log.obtained;
  const total = log.slots_total ?? log.total;
  const percent = total > 0 ? Math.round((filled / total) * 100) : null;
  // Against `obtained_unique`, not `obtained`: the page totals count a slot per
  // page, so an item on six pages counts six times, and comparing that with the
  // game's item count would call a full log incomplete.
  const partial = log.slots != null && log.obtained_unique < log.slots;

  return (
    <div className="space-y-6">
      <Header name={player.name} playerId={playerId} />

      <OsrsWindow
        title="Collection Log"
        subtitle={
          <span className={completionTone(filled, total)}>
            {filled.toLocaleString()}/{total.toLocaleString()}
            {percent != null ? ` (${percent}%)` : ""}
          </span>
        }
      >
        {partial && (
          <p className="border-osrs-bronze/20 text-osrs-parchment-dark/80 border-b px-3 py-2 text-xs">
            The game reports {filled.toLocaleString()} slots filled, but only{" "}
            {log.obtained_unique.toLocaleString()} have been recorded here. Opening the collection
            log in game captures the rest.
          </p>
        )}

        {!log.has_structure ? (
          <div className="p-4">
            <EmptyState
              title="Collection log structure unavailable"
              hint="The server has not synced the log's pages yet."
            />
          </div>
        ) : (
          <CollectionLogBrowser tabs={log.tabs} details={log.details} />
        )}
      </OsrsWindow>

      {log.unknown_recorded > 0 && (
        <p className="text-osrs-parchment-dark/50 text-xs">
          {log.unknown_recorded.toLocaleString()} recorded item
          {log.unknown_recorded === 1 ? " is" : "s are"} not part of any known collection log page —
          usually a sign the page structure needs re-syncing after a game update.
        </p>
      )}
    </div>
  );
}

function Header({ name, playerId }: { name: string; playerId: number }) {
  return (
    <div>
      <Link
        href={`/players/${playerId}`}
        className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-sm transition-colors"
      >
        ← {name}
      </Link>
      <h1 className="heading-rule mt-1 text-2xl font-bold">Collection log</h1>
    </div>
  );
}
