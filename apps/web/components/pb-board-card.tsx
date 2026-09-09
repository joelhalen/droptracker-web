"use client";

/**
 * One (boss, team size) board: the ranked times, each expandable to the gear,
 * inventory and character model it was set with.
 *
 * A client component only for the expand state. The loadout itself is fetched
 * when an entry is opened (see PbLoadout): a board lists up to 50 times and
 * most are never opened. The "gear" control is drawn only where the board
 * says a loadout exists — most times predate gear capture, and a button that
 * opens onto "nothing recorded" nine times in ten is worse than no button.
 * One entry open per board: the panel is large, and a board with several open
 * stops being a leaderboard.
 */
import { useState } from "react";
import Link from "next/link";
import type { PbTeamBoard } from "@droptracker/api-types";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { PbLoadout } from "@/components/pb-loadout";
import { Badge, Card, RankMedal } from "@/components/ui";
import { formatRelativeTime } from "@/lib/format";
import { entityPath } from "@/lib/slug";

/** Records set in the last 7 days get a "New" badge (matches RecordsShowcase). */
const NEW_RECORD_WINDOW_S = 7 * 24 * 3600;

export function BoardCard({ board, isGroupScoped }: { board: PbTeamBoard; isGroupScoped: boolean }) {
  const now = Math.floor(Date.now() / 1000);
  const [openPb, setOpenPb] = useState<number | null>(null);
  return (
    <Card padding="p-4" className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-osrs-gold font-semibold">{board.size_label}</h3>
        <span className="text-osrs-parchment-dark/60 shrink-0 text-xs">
          {board.total_players.toLocaleString()} ranked
        </span>
      </div>
      <ol className="space-y-1">
        {board.entries.map((e) => {
          const isNew = e.date_ts != null && e.date_ts > 0 && now - e.date_ts < NEW_RECORD_WINDOW_S;
          const gearId = e.has_loadout && e.pb_id != null ? e.pb_id : null;
          const isOpen = gearId != null && openPb === gearId;
          return (
            <li
              key={e.player_id}
              className={`rounded ${
                e.rank === 1 ? "bg-osrs-gold/10" : e.rank <= 3 ? "bg-osrs-surface-2/50" : ""
              }`}
            >
              <div className="flex items-center gap-2.5 px-2 py-1.5">
                <RankMedal rank={e.rank} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <EntityHoverCard
                      kind="player"
                      id={e.player_id}
                      name={e.player_name}
                      className="min-w-0 truncate"
                    >
                      <Link
                        href={entityPath("players", e.player_id, e.player_name)}
                        className="hover:text-osrs-gold-bright truncate text-sm font-medium transition-colors"
                      >
                        {e.player_name}
                      </Link>
                    </EntityHoverCard>
                    {isNew && <Badge variant="gold">New</Badge>}
                  </span>
                  <span className="text-osrs-parchment-dark/50 block truncate text-[11px]">
                    {isGroupScoped && e.global_rank != null && (
                      <span title="Position on the global board">Global #{e.global_rank}</span>
                    )}
                    {isGroupScoped &&
                      e.global_rank != null &&
                      e.date_ts != null &&
                      e.date_ts > 0 &&
                      " · "}
                    {e.date_ts != null && e.date_ts > 0 && formatRelativeTime(e.date_ts)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`font-mono text-sm font-bold tabular-nums ${
                      e.rank === 1 ? "text-osrs-gold-bright" : "text-osrs-parchment"
                    }`}
                  >
                    {e.time_display}
                  </span>
                  {gearId != null && (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`pb-gear-${gearId}`}
                      onClick={() => setOpenPb(isOpen ? null : gearId)}
                      title={
                        isOpen
                          ? "Hide the gear worn for this time"
                          : "Show the gear worn for this time"
                      }
                      className={`rounded px-1 text-[11px] whitespace-nowrap transition-colors ${
                        isOpen
                          ? "text-osrs-gold-bright"
                          : "text-osrs-parchment-dark/50 hover:text-osrs-gold-bright"
                      }`}
                    >
                      Gear {isOpen ? "▴" : "▾"}
                    </button>
                  )}
                  {e.image_url && (
                    <a
                      href={e.image_url}
                      target="_blank"
                      rel="noreferrer"
                      title="View proof screenshot"
                      aria-label="View proof screenshot"
                      className="text-osrs-parchment-dark/40 hover:text-osrs-gold-bright text-xs transition-colors"
                    >
                      📷
                    </a>
                  )}
                </span>
              </div>
              {isOpen && (
                <div
                  id={`pb-gear-${gearId}`}
                  className="border-osrs-bronze/20 mx-2 mb-2 border-t pt-3"
                >
                  <PbLoadout pbId={gearId} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
