"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { PbBossSummary } from "@droptracker/api-types";
import { fieldInputClass } from "@/components/ui";

/**
 * Boss selector for the group "Personal bests" tab — navigates via the
 * `?boss=` search param so the selection is server-rendered and linkable.
 */
export function PbBossPicker({
  bosses,
  selected,
  basePath,
}: {
  bosses: PbBossSummary[];
  selected: number;
  basePath: string;
}) {
  const router = useRouter();
  return (
    <select
      value={selected}
      onChange={(e) => router.push(`${basePath}?boss=${e.target.value}` as Route)}
      aria-label="Choose a boss"
      className={`${fieldInputClass} w-full max-w-sm`}
    >
      {bosses.map((b) => (
        <option key={b.npc_id} value={b.npc_id}>
          {b.name} ({b.player_count.toLocaleString()} ranked)
        </option>
      ))}
    </select>
  );
}
