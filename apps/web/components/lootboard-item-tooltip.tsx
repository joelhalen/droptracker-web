/**
 * Per-player breakdown inside lootboard item-stack tooltips: who received the
 * stack, how much of it, and how recently. Shared by the 1:1 canvas board
 * (lootboard-canvas.tsx) and the fallback grid (lootboard-grid.tsx).
 * Contributors come capped from the API (top recipients by value) with
 * `contributor_count` carrying the true recipient total.
 */
import type { LootItem } from "@droptracker/api-types";
import { formatGp } from "@/lib/format";
import { timeSince } from "@/lib/lootboard-layout";

export function ItemContributors({ item }: { item: LootItem }) {
  const contributors = item.contributors ?? [];
  if (!contributors.length) return null;
  const more = (item.contributor_count ?? contributors.length) - contributors.length;
  return (
    <div className="border-osrs-bronze/40 mt-1.5 space-y-0.5 border-t pt-1.5">
      {contributors.map((c) => (
        <div key={c.player_id} className="flex items-baseline justify-between gap-3">
          <span className="text-osrs-parchment min-w-0 truncate">{c.player_name}</span>
          <span className="text-osrs-parchment-dark/80 shrink-0 tabular-nums">
            {item.is_coin ? c.value.value_formatted : `${formatGp(c.quantity)}× · ${c.value.value_formatted}`}
            {c.last_at ? ` ${timeSince(c.last_at)}` : ""}
          </span>
        </div>
      ))}
      {more > 0 && (
        <div className="text-osrs-parchment-dark/60">
          +{more} more player{more === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}
