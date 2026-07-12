"use client";

/**
 * Rich hover cards for players and groups — the shared way to make any
 * player/group name on the site hoverable (leaderboards, search results,
 * profile group lists, submission feeds, the live ticker…).
 *
 * Wraps the portal-based `HoverCard` and lazily fetches a compact summary
 * from the BFF card routes (`/api/players/[id]/card`, `/api/groups/[id]/card`)
 * the first time a given entity's card opens; results are cached per session
 * so re-hovers are instant. Callers can pass `seed` context they already have
 * (leaderboard rank, period loot, badge chips) — it renders immediately while
 * the richer summary loads underneath.
 */
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { entityPath } from "@/lib/slug";
import type { CompactBadge } from "@droptracker/api-types";
import type { EntityCard, GroupCard, PlayerCard } from "@/lib/entity-card";
import { CARD_SECTION_CLASS as DIVIDER, CardStatLine as StatLine, HoverCard } from "@/components/hover-card";
import { CompactBadgeDetails } from "@/components/player-badges";
import { Badge, NameTile, RankMedal, Skeleton, TierBadge } from "@/components/ui";

export type EntityKind = "player" | "group";

/** Context the call site already knows — shown instantly, before/alongside the fetch. */
export type EntitySeed = {
  /** Rank within the listing the trigger sits in (e.g. period leaderboard). */
  rank?: number;
  /** Formatted loot for that listing's period. */
  loot?: string;
  /** Label for the seed rank/loot line, e.g. "this month". */
  periodLabel?: string;
  /** Compact badge chips from the listing row (players only). */
  badges?: CompactBadge[];
};

/* ----------------------------------------------------------------------- */
/* Session-scoped card cache: fetch once per entity, reuse across hovers.  */
/* ----------------------------------------------------------------------- */

const cardCache = new Map<string, EntityCard>();
const inflight = new Map<string, Promise<EntityCard>>();

async function fetchCard(kind: EntityKind, id: number): Promise<EntityCard> {
  const key = `${kind}:${id}`;
  const cached = cardCache.get(key);
  if (cached) return cached;
  const pending = inflight.get(key);
  if (pending) return pending;
  const promise = (async () => {
    const res = await fetch(`/api/${kind === "player" ? "players" : "groups"}/${id}/card`);
    if (!res.ok) throw new Error(`card fetch ${res.status}`);
    const card = (await res.json()) as EntityCard;
    cardCache.set(key, card);
    return card;
  })();
  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

function useEntityCard(kind: EntityKind, id: number) {
  const [card, setCard] = useState<EntityCard | null>(cardCache.get(`${kind}:${id}`) ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    fetchCard(kind, id)
      .then((c) => active && setCard(c))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [kind, id]);
  return { card, failed };
}

/* ----------------------------------------------------------------------- */
/* Card bodies                                                             */
/* ----------------------------------------------------------------------- */

function CardShell({
  href,
  linkLabel,
  children,
}: {
  href: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="p-3">
      {children}
      <Link
        href={href as Route}
        className="text-osrs-gold-bright mt-2.5 block text-xs font-medium hover:underline"
      >
        {linkLabel} →
      </Link>
    </div>
  );
}

/** Two shimmer lines standing in for the fetched summary block. */
function LoadingRows() {
  return (
    <div className={`${DIVIDER} space-y-1.5`} aria-busy="true">
      <Skeleton className="h-3.5 w-3/4" />
      <Skeleton className="h-3.5 w-1/2" />
    </div>
  );
}

/** "Top X%" hint (mirrors the profile hero tile) — only when meaningfully high. */
function percentile(rank?: number, ranked?: number): string | null {
  if (!rank || !ranked || ranked < 100) return null;
  const pct = (rank / ranked) * 100;
  if (pct > 50) return null;
  const display = pct < 1 ? Math.max(0.1, Math.round(pct * 10) / 10) : Math.ceil(pct);
  return `Top ${display}%`;
}

function PlayerCardBody({ id, name, seed }: { id: number; name: string; seed?: EntitySeed }) {
  const { card, failed } = useEntityCard("player", id);
  const player = card?.kind === "player" ? (card as PlayerCard) : null;

  const seedLine =
    seed?.rank != null || seed?.loot ? (
      <>
        {seed.rank != null && `Rank #${seed.rank}`}
        {seed.rank != null && seed.loot && " · "}
        {seed.loot && `${seed.loot} ${seed.periodLabel ?? "this period"}`}
      </>
    ) : null;
  const pct = percentile(player?.global_rank, player?.ranked_players);

  return (
    <CardShell href={entityPath("players", id, name)} linkLabel="View full profile">
      <div className="flex items-center gap-2.5">
        <NameTile name={name} size="md" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{name}</span>
            {player?.is_supporter && (
              <Badge tone="gold" title="This player supports DropTracker" className="shrink-0 px-1.5">
                ★
              </Badge>
            )}
          </div>
          <div className="text-osrs-parchment-dark/60 truncate text-xs">
            {seedLine ?? (player?.global_rank != null ? `Global rank #${player.global_rank}` : "Player")}
          </div>
        </div>
      </div>

      {player ? (
        <div className={`${DIVIDER} space-y-1`}>
          <StatLine
            label="Global rank"
            value={
              player.global_rank != null ? (
                <>
                  #{player.global_rank}
                  {pct && <span className="text-osrs-parchment-dark/60"> · {pct}</span>}
                </>
              ) : (
                "—"
              )
            }
          />
          <StatLine label="Monthly loot" value={player.total_loot?.value_formatted ?? "—"} />
          {player.top_npc && <StatLine label="Top NPC" value={player.top_npc} />}
          {player.points != null && player.points > 0 && (
            <StatLine label="Points" value={player.points.toLocaleString()} />
          )}
        </div>
      ) : failed ? null : (
        <LoadingRows />
      )}

      {(seed?.badges?.length ?? 0) > 0 ? (
        <div className={DIVIDER}>
          <CompactBadgeDetails badges={seed!.badges!} />
        </div>
      ) : player && player.badges.length > 0 ? (
        <div className={`${DIVIDER} flex flex-wrap items-center gap-1`}>
          {player.badges.map((b) => (
            <Badge key={b.key} tone={b.tone} className="px-1.5" title={b.label}>
              {b.icon_url ? (
                <img src={b.icon_url} alt="" className="size-3.5 shrink-0 object-contain" />
              ) : (
                <span aria-hidden>{b.emoji ?? "★"}</span>
              )}
              <span className="max-w-28 truncate">{b.label}</span>
            </Badge>
          ))}
          {player.badge_count > player.badges.length && (
            <Badge tone="neutral" className="px-1.5">
              +{player.badge_count - player.badges.length}
            </Badge>
          )}
        </div>
      ) : null}

      {player && player.groups.length > 0 && (
        <div className={DIVIDER}>
          <div className="text-osrs-parchment-dark/60 mb-1.5 text-[11px] font-semibold tracking-wider uppercase">
            Groups
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {player.groups.map((g) => (
              <Link
                key={g.id}
                href={entityPath("groups", g.id, g.name)}
                className="hover:text-osrs-gold-bright flex min-w-0 items-center gap-1.5 text-xs font-medium transition-colors"
                title={g.flair?.tier_name}
              >
                <NameTile name={g.name} size="sm" flair={g.flair?.style} />
                <span className="max-w-32 truncate">{g.name}</span>
              </Link>
            ))}
            {player.group_count > player.groups.length && (
              <span className="text-osrs-parchment-dark/60 text-xs">
                +{player.group_count - player.groups.length} more
              </span>
            )}
          </div>
        </div>
      )}
    </CardShell>
  );
}

function GroupCardBody({ id, name, seed }: { id: number; name: string; seed?: EntitySeed }) {
  const { card, failed } = useEntityCard("group", id);
  const group = card?.kind === "group" ? (card as GroupCard) : null;

  const memberLine =
    group != null
      ? `${group.member_count.toLocaleString()} member${group.member_count === 1 ? "" : "s"}`
      : null;
  const seedLine =
    seed?.rank != null || seed?.loot ? (
      <>
        {seed.rank != null && `Rank #${seed.rank}`}
        {seed.rank != null && seed.loot && " · "}
        {seed.loot && `${seed.loot} ${seed.periodLabel ?? "this period"}`}
      </>
    ) : null;

  return (
    <CardShell href={entityPath("groups", id, name)} linkLabel="View clan profile">
      <div className="flex items-center gap-2.5">
        <NameTile name={name} size="md" flair={group?.flair?.style} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{name}</span>
            {group?.flair && (
              <TierBadge
                tierKey={group.flair.tier_key}
                name={group.flair.tier_name}
                className="shrink-0"
              />
            )}
          </div>
          <div className="text-osrs-parchment-dark/60 truncate text-xs">
            {seedLine ?? memberLine ?? "Clan"}
          </div>
        </div>
      </div>

      {group ? (
        <>
          {group.description && (
            <p className="text-osrs-parchment-dark/80 mt-2 line-clamp-2 text-xs">
              {group.description}
            </p>
          )}
          <div className={`${DIVIDER} space-y-1`}>
            <StatLine label="Members" value={group.member_count.toLocaleString()} />
            <StatLine
              label="Global rank"
              value={group.global_rank != null ? `#${group.global_rank}` : "—"}
            />
            <StatLine label="Monthly loot" value={group.monthly_loot?.value_formatted ?? "—"} />
            {group.top_boss && <StatLine label="Most active" value={group.top_boss.name} />}
          </div>
          {group.top_players.length > 0 && (
            <div className={DIVIDER}>
              <div className="text-osrs-parchment-dark/60 mb-1.5 text-[11px] font-semibold tracking-wider uppercase">
                Top players this month
              </div>
              <ol className="space-y-1">
                {group.top_players.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-xs">
                    <RankMedal rank={p.rank} className="scale-90" />
                    <Link
                      href={entityPath("players", p.id, p.name)}
                      className="hover:text-osrs-gold-bright min-w-0 flex-1 truncate font-medium transition-colors"
                    >
                      {p.name}
                    </Link>
                    <span className="text-osrs-gold-bright shrink-0 font-semibold tabular-nums">
                      {p.loot.value_formatted}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      ) : failed ? null : (
        <LoadingRows />
      )}
    </CardShell>
  );
}

/* ----------------------------------------------------------------------- */
/* Public wrapper                                                          */
/* ----------------------------------------------------------------------- */

export function EntityHoverCard({
  kind,
  id,
  name,
  seed,
  className = "",
  children,
}: {
  kind: EntityKind;
  id: number;
  name: string;
  seed?: EntitySeed;
  /** Classes for the inline trigger wrapper (layout, e.g. "flex items-center gap-1.5"). */
  className?: string;
  children: ReactNode;
}) {
  const content =
    kind === "player" ? (
      <PlayerCardBody id={id} name={name} seed={seed} />
    ) : (
      <GroupCardBody id={id} name={name} seed={seed} />
    );
  return (
    <HoverCard content={content} className={className}>
      {children}
    </HoverCard>
  );
}
