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

import { Card } from "@/components/ui";

const IMG_BASE = "https://www.droptracker.io/img";
const INITIAL_CARDS = 12;

export function PersonalBestsGrid({ pbs }: { pbs: PersonalBestSummary[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? pbs : pbs.slice(0, INITIAL_CARDS);
  return (
    <div>
      <div className="stagger-children grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((pb) => (
          <Card key={pb.npc_id} padding="p-4">
            <div className="flex items-center gap-2.5">
              <img
                src={`${IMG_BASE}/npcdb/${pb.npc_id}.png`}
                alt=""
                className="size-8 shrink-0 rounded object-contain"
                loading="lazy"
              />
              <Link
                href={entityPath("npcs", pb.npc_id, pb.boss)}
                className="hover:text-osrs-gold-bright truncate text-sm font-medium transition-colors"
                title={pb.boss}
              >
                {pb.boss}
              </Link>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-osrs-gold-bright font-mono text-xl font-bold tabular-nums">
                {pb.time_display}
              </span>
              <span className="text-osrs-parchment-dark/60 text-xs">{pb.team_size}</span>
            </div>
          </Card>
        ))}
      </div>
      {pbs.length > INITIAL_CARDS && (
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
          className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 mt-4 rounded border px-3 py-1.5 text-sm font-medium"
        >
          {showAll ? "Show fewer" : `Show all ${pbs.length.toLocaleString()} personal bests`}
        </button>
      )}
    </div>
  );
}
