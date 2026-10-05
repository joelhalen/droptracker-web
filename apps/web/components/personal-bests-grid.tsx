"use client";

/**
 * Expandable grid of a player's best time per boss. The profile API returns
 * every boss the player holds a PB for; we collapse past the first dozen
 * behind a "Show all" toggle (same pattern as the loot tracker's NPC grid on
 * this page) so deep PB hunters don't dominate the profile by default.
 */

import { useState } from "react";
import Link from "next/link";
import { entityPath } from "@/lib/slug";
import type { PersonalBestSummary } from "@droptracker/api-types";

import { Button, Card } from "@/components/ui";
import { PbLoadout } from "@/components/pb-loadout";
import { PbTime } from "@/components/pb-time";

const IMG_BASE = "https://www.droptracker.io/img";
const INITIAL_CARDS = 12;

export function PersonalBestsGrid({
  pbs,
  imgBase = IMG_BASE,
  onOpenBoss,
}: {
  pbs: PersonalBestSummary[];
  /** The Discord Activity passes "/img": its iframe CSP only allows same-origin images. */
  imgBase?: string;
  /** Replaces the NPC page link. The Activity has no site routes, so it opens
   * its own PB board for the boss instead. */
  onOpenBoss?: (pb: PersonalBestSummary) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  // Which entry has its loadout open. One at a time: the panels are large, and
  // opening several turns the grid into a wall of item icons.
  const [openLoadout, setOpenLoadout] = useState<number | null>(null);
  const visible = showAll ? pbs : pbs.slice(0, INITIAL_CARDS);
  return (
    <div>
      <div className="stagger-children grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((pb) => (
          <Card key={pb.npc_id} padding="p-4">
            <div className="flex items-center gap-2.5">
              <img
                src={`${imgBase}/npcdb/${pb.npc_id}.png`}
                alt=""
                className="size-8 shrink-0 rounded object-contain"
                loading="lazy"
              />
              {onOpenBoss ? (
                <button
                  type="button"
                  onClick={() => onOpenBoss(pb)}
                  className="hover:text-osrs-gold-bright truncate text-left text-sm font-medium transition-colors"
                  title={pb.boss}
                >
                  {pb.boss}
                </button>
              ) : (
                <Link
                  href={entityPath("npcs", pb.npc_id, pb.boss)}
                  className="hover:text-osrs-gold-bright truncate text-sm font-medium transition-colors"
                  title={pb.boss}
                >
                  {pb.boss}
                </Link>
              )}
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-osrs-gold-bright font-mono text-xl font-bold tabular-nums">
                <PbTime display={pb.time_display} approximate={pb.approximate} />
              </span>
              <span className="text-osrs-parchment-dark/60 text-xs">{pb.team_size}</span>
            </div>
            {pb.pb_id != null && (
              <>
                <button
                  type="button"
                  aria-expanded={openLoadout === pb.pb_id}
                  onClick={() =>
                    setOpenLoadout((cur) => (cur === pb.pb_id ? null : pb.pb_id!))
                  }
                  className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright mt-2 text-xs transition-colors"
                >
                  {openLoadout === pb.pb_id ? "Hide gear" : "Show gear"}
                </button>
                {openLoadout === pb.pb_id && (
                  <div className="border-osrs-bronze/20 mt-3 border-t pt-3">
                    <PbLoadout pbId={pb.pb_id} />
                  </div>
                )}
              </>
            )}
          </Card>
        ))}
      </div>
      {pbs.length > INITIAL_CARDS && (
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
          className="mt-4"
        >
          {showAll ? "Show fewer" : `Show all ${pbs.length.toLocaleString()} personal bests`}
        </Button>
      )}
    </div>
  );
}
