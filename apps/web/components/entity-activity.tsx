/**
 * Shared list blocks for the NPC and item pages: all-time top players/receivers
 * and the latest tracked drops. Server-renderable (links + hover cards only).
 */
import Link from "next/link";
import { entityPath } from "@/lib/slug";
import type { Money } from "@droptracker/api-types";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { EmptyState, RankMedal } from "@/components/ui";
import { formatRelativeTime } from "@/lib/format";

export type TopPlayerRow = {
  rank: number;
  player_id: number;
  player_name: string;
  loot: Money;
  /** Tracked drop rows for this player (labelled "drops" in the UI). */
  drop_count: number;
};

export function TopPlayersList({ rows }: { rows: TopPlayerRow[] }) {
  if (rows.length === 0) {
    return <EmptyState title="No tracked players yet" />;
  }
  return (
    <ol className="space-y-1">
      {rows.map((p) => (
        <li
          key={p.player_id}
          className={`flex items-center gap-2.5 rounded px-2 py-1.5 ${
            p.rank === 1 ? "bg-osrs-gold/10" : p.rank <= 3 ? "bg-osrs-surface-2/50" : ""
          }`}
        >
          <RankMedal rank={p.rank} className="shrink-0" />
          <EntityHoverCard
            kind="player"
            id={p.player_id}
            name={p.player_name}
            className="min-w-0 flex-1 truncate"
          >
            <Link
              href={entityPath("players", p.player_id, p.player_name)}
              className="hover:text-osrs-gold-bright truncate text-sm font-medium transition-colors"
            >
              {p.player_name}
            </Link>
          </EntityHoverCard>
          <span className="shrink-0 text-right">
            <span className="text-osrs-gold-bright block text-sm font-semibold tabular-nums">
              {p.loot.value_formatted}
            </span>
            <span className="text-osrs-parchment-dark/50 block text-[11px]">
              {p.drop_count.toLocaleString()} drops
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export type RecentDropRow = {
  drop_id: number;
  player_id: number;
  player_name: string;
  value: Money;
  quantity: number;
  ts: number;
  /** Item context (NPC page) or NPC context (item page) — whichever applies. */
  context_id: number | null;
  context_name: string | null;
  context_href: "items" | "npcs";
  icon_url: string | null;
};

export function RecentDropsList({ rows }: { rows: RecentDropRow[] }) {
  if (rows.length === 0) {
    return <EmptyState title="No tracked drops yet" />;
  }
  return (
    <ul className="divide-osrs-bronze/15 divide-y">
      {rows.map((d) => (
        <li key={d.drop_id} className="flex items-center gap-2.5 py-2 text-sm">
          {d.icon_url ? (
            <img src={d.icon_url} alt="" className="size-7 shrink-0 object-contain" />
          ) : (
            <span className="bg-osrs-bronze/20 size-7 shrink-0 rounded" aria-hidden />
          )}
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <EntityHoverCard
                kind="player"
                id={d.player_id}
                name={d.player_name}
                className="min-w-0 truncate"
              >
                <Link
                  href={entityPath("players", d.player_id, d.player_name)}
                  className="hover:text-osrs-gold-bright truncate font-medium transition-colors"
                >
                  {d.player_name}
                </Link>
              </EntityHoverCard>
              {d.quantity > 1 && (
                <span className="text-osrs-parchment-dark/60 shrink-0 text-xs">×{d.quantity}</span>
              )}
            </span>
            <span className="text-osrs-parchment-dark/60 block truncate text-xs">
              {d.context_id != null && d.context_name ? (
                <Link
                  href={entityPath(d.context_href, d.context_id, d.context_name)}
                  className="hover:text-osrs-gold-bright transition-colors"
                >
                  {d.context_name}
                </Link>
              ) : (
                (d.context_name ?? "Unknown")
              )}
              {" · "}
              {formatRelativeTime(d.ts)}
            </span>
          </span>
          <span className="text-osrs-green shrink-0 text-sm font-semibold tabular-nums">
            {d.value.value_formatted}
          </span>
        </li>
      ))}
    </ul>
  );
}
