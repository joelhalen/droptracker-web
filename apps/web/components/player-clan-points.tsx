"use client";

/**
 * A player's clan points on their profile — site and Discord Activity.
 *
 * Site-wide points are retired; what a profile shows now is the player's
 * standing in ONE clan's points system: a clan the viewer shares with them if
 * there is one, otherwise their best placing (the backend picks, see
 * `GET /players/{id}/group-points`). Clans with points switched off never
 * appear, and a player with nothing to show renders nothing — no "0" tile.
 *
 * Loaded in the browser because the pick depends on who is looking, and the
 * profile page itself is ISR-cached for everyone.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { PlayerGroupPoints } from "@droptracker/api-types";
import { CountUp } from "@/components/count-up";
import { EntityLink } from "@/components/entity-link";
import { useEmbedHost } from "@/lib/embed-host";
import { entityPath } from "@/lib/slug";

type Featured = NonNullable<PlayerGroupPoints["featured"]>;

function hint(f: Featured): string {
  const parts = [`#${f.rank.toLocaleString()} of ${f.ranked.toLocaleString()}`];
  if (f.month_points) parts.push(`${f.month_points.toLocaleString()} this month`);
  return parts.join(" · ");
}

export function ClanPointsTile({ featured, more }: { featured: Featured; more: number }) {
  const host = useEmbedHost();
  const body = (
    <>
      <div className="text-osrs-parchment-dark/60 flex items-baseline justify-between gap-2 text-xs tracking-wide uppercase">
        <span>Clan points</span>
        {more > 0 && (
          <span className="normal-case tracking-normal" title="Other clans this player has points in">
            +{more} more
          </span>
        )}
      </div>
      <div className="text-osrs-gold-bright mt-0.5 text-2xl font-bold tabular-nums">
        <CountUp value={featured.points} formatted={featured.points.toLocaleString()} />
      </div>
      <div className="text-osrs-parchment-dark/50 mt-0.5 truncate text-xs">
        <span className="text-osrs-parchment-dark/80">{featured.group_name}</span> · {hint(featured)}
      </div>
    </>
  );
  const cls =
    "bg-osrs-surface-2/70 hover:bg-osrs-surface-2 block w-full rounded-lg px-4 py-3 text-left transition-colors";
  if (host) {
    return (
      <EntityLink kind="group" id={featured.group_id} name={featured.group_name} className={cls}>
        {body}
      </EntityLink>
    );
  }
  return (
    <Link
      href={`${entityPath("groups", featured.group_id, featured.group_name)}/points/leaderboard` as Route}
      className={cls}
      title={`${featured.group_name} points leaderboard`}
    >
      {body}
    </Link>
  );
}

/** Fetches with `load` and shows the tile, or nothing. `load` must be stable
 * per player (memoise it), it is the effect's dependency. */
export function PlayerClanPoints({ load }: { load: () => Promise<PlayerGroupPoints> }) {
  const [data, setData] = useState<PlayerGroupPoints | null>(null);
  useEffect(() => {
    let active = true;
    setData(null);
    load()
      .then((d) => active && setData(d))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [load]);
  if (!data?.featured) return null;
  return <ClanPointsTile featured={data.featured} more={Math.max(0, data.groups.length - 1)} />;
}

/** Site loader: the same-origin BFF, which forwards the viewer's session. */
export function SitePlayerClanPoints({ playerId }: { playerId: number }) {
  const [load] = useState(() => async (): Promise<PlayerGroupPoints> => {
    const res = await fetch(`/api/players/${playerId}/group-points`);
    if (!res.ok) throw new Error(`group-points ${res.status}`);
    return (await res.json()) as PlayerGroupPoints;
  });
  return <PlayerClanPoints load={load} />;
}
