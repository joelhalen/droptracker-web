/**
 * Stat blocks for the public group/player profile pages: ranked member lists,
 * most-farmed boss meters, and PB record showcases. Server components — all
 * motion is CSS (`stagger-children`, `bar-grow`, `record-glow` in globals.css)
 * so the sections animate on arrival without any client JS.
 */

import Link from "next/link";
import type { Route } from "next";
import type { GroupRecord, GroupTopPlayer, PersonalBestSummary, TopBoss } from "@droptracker/api-types";

import { EntityHoverCard } from "@/components/entity-hover-card";
import { Badge, Card, EntityChip, RankMedal } from "@/components/ui";
import { formatRelativeTime } from "@/lib/format";

const IMG_BASE = "https://www.droptracker.io/img";
const NEW_RECORD_WINDOW_S = 7 * 24 * 3600;

/** Ranked members by monthly loot, with a relative meter per row. */
export function TopPlayersList({ players }: { players: GroupTopPlayer[] }) {
  const max = Math.max(...players.map((p) => p.loot.value), 1);
  return (
    <ol className="stagger-children divide-osrs-bronze/15 divide-y">
      {players.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-2.5">
          <RankMedal rank={p.rank} />
          <div className="min-w-0 flex-1">
            <EntityHoverCard
              kind="player"
              id={p.id}
              name={p.name}
              seed={{ rank: p.rank, loot: p.loot.value_formatted, periodLabel: "this month" }}
              className="flex min-w-0"
            >
              <EntityChip href={`/players/${p.id}`} name={p.name} size="sm" />
            </EntityHoverCard>
            <div className="bg-osrs-surface-3/60 mt-1.5 h-1 overflow-hidden rounded-full">
              <div
                className="bar-grow bg-osrs-gold/70 h-full rounded-full"
                style={{ width: `${Math.max(2, (p.loot.value / max) * 100)}%` }}
              />
            </div>
          </div>
          <span className="text-osrs-gold-bright text-sm font-semibold tabular-nums">
            {p.loot.value_formatted}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Most-farmed NPCs this month — icon, drop count, loot meter. */
export function BossActivityList({ bosses }: { bosses: TopBoss[] }) {
  const max = Math.max(...bosses.map((b) => b.loot.value), 1);
  return (
    <ul className="stagger-children space-y-3">
      {bosses.map((b) => (
        <li key={b.npc_id} className="flex items-center gap-3">
          {/* npcdb icons exist for tracked bosses; hide the img on 404 via alt="" + no border */}
          <img
            src={`${IMG_BASE}/npcdb/${b.npc_id}.png`}
            alt=""
            className="size-9 shrink-0 rounded object-contain"
            loading="lazy"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium">{b.name}</span>
              <span className="text-osrs-gold-bright shrink-0 text-sm font-semibold tabular-nums">
                {b.loot.value_formatted}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="bg-osrs-surface-3/60 h-1.5 flex-1 overflow-hidden rounded-full">
                <div
                  className="bar-grow bg-osrs-ember/70 h-full rounded-full"
                  style={{ width: `${Math.max(2, (b.loot.value / max) * 100)}%` }}
                />
              </div>
              <span className="text-osrs-parchment-dark/60 shrink-0 text-xs tabular-nums">
                {b.drops.toLocaleString()} drops
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Group records: the fastest kill per boss and who holds it. */
export function RecordsShowcase({ records }: { records: GroupRecord[] }) {
  const now = Math.floor(Date.now() / 1000);
  return (
    <div className="stagger-children grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {records.map((r) => {
        const isNew = r.date_ts > 0 && now - r.date_ts < NEW_RECORD_WINDOW_S;
        return (
          <Card
            key={r.npc_id}
            padding="p-4"
            className={`relative overflow-hidden ${isNew ? "record-glow" : ""}`}
          >
            {isNew && (
              <Badge tone="gold" className="absolute top-2 right-2">
                New
              </Badge>
            )}
            <div className="flex items-center gap-2.5">
              <img
                src={`${IMG_BASE}/npcdb/${r.npc_id}.png`}
                alt=""
                className="size-8 shrink-0 rounded object-contain"
                loading="lazy"
              />
              <span className="truncate text-sm font-medium" title={r.boss}>
                {r.boss}
              </span>
            </div>
            <div className="text-osrs-gold-bright mt-2 font-mono text-xl font-bold tabular-nums">
              {r.time_display}
            </div>
            <div className="text-osrs-parchment-dark/70 mt-1 flex items-center justify-between gap-2 text-xs">
              <EntityHoverCard
                kind="player"
                id={r.holder.id}
                name={r.holder.name}
                className="min-w-0 truncate"
              >
                <Link
                  href={`/players/${r.holder.id}` as Route}
                  className="hover:text-osrs-gold-bright truncate font-medium transition-colors"
                >
                  {r.holder.name}
                </Link>
              </EntityHoverCard>
              <span className="shrink-0">{r.team_size}</span>
            </div>
            {r.date_ts > 0 && (
              <div className="text-osrs-parchment-dark/50 mt-1 text-xs">
                {formatRelativeTime(r.date_ts)}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/** A player's best time per boss. */
export function PersonalBestsShowcase({ pbs }: { pbs: PersonalBestSummary[] }) {
  return (
    <div className="stagger-children grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {pbs.map((pb) => (
        <Card key={pb.npc_id} padding="p-4">
          <div className="flex items-center gap-2.5">
            <img
              src={`${IMG_BASE}/npcdb/${pb.npc_id}.png`}
              alt=""
              className="size-8 shrink-0 rounded object-contain"
              loading="lazy"
            />
            <span className="truncate text-sm font-medium" title={pb.boss}>
              {pb.boss}
            </span>
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
  );
}
