/**
 * Leaderboard cards: one per clan or player, a large variant for the podium.
 *
 * Each card is a single stretched link to the profile (`.lb2-card-link` covers
 * the card); the few links inside it (top earner, a player's clans) are lifted
 * above that overlay with `.lb2-raise`, which keeps them clickable without
 * nesting anchors.
 */
import Link from "next/link";
import type { Route } from "next";
import { NameTile } from "@/components/ui";
import { PlayerBadgeIcons } from "@/components/player-badges";
import { entityPath } from "@/lib/slug";
import { resolveFlair } from "@/lib/tier-flair";
import { formatGp } from "@/lib/format";
import { clanIcon, gpTier, type CardEntry } from "./board-data";
import { ClanIcon } from "./clan-icon";

type CardProps = {
  entry: CardEntry;
  /** Loot of the board's #1, for the relative bar. */
  leader: number;
  /** "this week", "in September"… for the active-member label. */
  phrase: string;
  podium?: boolean;
};

function Rank({ rank }: { rank: number }) {
  return (
    <span className="lb2-rank" data-rank={rank <= 3 ? rank : undefined}>
      {rank <= 3 ? <span aria-hidden>{["I", "II", "III"][rank - 1]}</span> : null}
      <span className={rank <= 3 ? "sr-only" : undefined}>#{rank}</span>
    </span>
  );
}

function Loot({ value, formatted, delta }: { value: number; formatted: string; delta?: number }) {
  return (
    <p className="lb2-loot">
      <span className="lb2-gp" data-tier={gpTier(value)}>
        {formatted}
      </span>
      <span className="lb2-gp-unit">gp</span>
      {delta != null && delta > 0 && <em className="lb2-delta">+{formatGp(delta)}</em>}
    </p>
  );
}

function Bar({ value, leader }: { value: number; leader: number }) {
  const pct = leader > 0 ? Math.max(2, Math.min(100, (value / leader) * 100)) : 0;
  return (
    <div className="lb2-bar" aria-hidden>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/** "365 members · 130 active", the grid card's one-line roster summary. */
function ClanMeta({ entry, phrase }: { entry: CardEntry; phrase: string }) {
  const parts: string[] = [];
  if (entry.member_count != null) parts.push(`${entry.member_count.toLocaleString("en-US")} members`);
  if (entry.active_count != null) parts.push(`${entry.active_count.toLocaleString("en-US")} active`);
  if (!parts.length) return null;
  return (
    <p className="lb2-meta" title={`Active = members with loot tracked ${phrase}`}>
      {parts.join(" · ")}
    </p>
  );
}

export function GroupCard({ entry, leader, phrase, podium }: CardProps) {
  const flair = resolveFlair(entry.flair?.style);
  const icon = clanIcon(entry.icon_url);
  const href = entityPath("groups", entry.id, entry.name);
  return (
    <article
      className="lb2-card"
      data-size={podium ? "lg" : undefined}
      data-flair={entry.flair?.style}
      data-podium={podium ? entry.rank : undefined}
    >
      <Link href={href} className="lb2-card-link" aria-label={`${entry.name}, rank ${entry.rank}`} />
      <header className="lb2-card-head">
        <Rank rank={entry.rank} />
        {entry.flair && flair && (
          <span className="lb2-tier" title={`${entry.flair.tier_name} supporter`}>
            <span aria-hidden>{flair.marker}</span> {entry.flair.tier_name}
          </span>
        )}
      </header>

      <div className="lb2-ident">
        <ClanIcon src={icon} name={entry.name} flair={entry.flair?.style} />
        <div className="lb2-ident-text">
          <h3 className={`lb2-name ${flair?.nameClassName ?? ""}`} style={flair?.nameStyle}>
            {entry.name}
          </h3>
          {!podium && <ClanMeta entry={entry} phrase={phrase} />}
          {entry.description && <p className="lb2-desc">{entry.description}</p>}
        </div>
      </div>

      <Loot value={entry.loot.value} formatted={entry.loot.value_formatted} />
      <Bar value={entry.loot.value} leader={leader} />

      {podium && (
        <dl className="lb2-stats">
          {entry.member_count != null && (
            <div>
              <dt>Members</dt>
              <dd>{entry.member_count.toLocaleString("en-US")}</dd>
            </div>
          )}
          {entry.active_count != null && (
            <div title={`Members with loot tracked ${phrase}`}>
              <dt>Active</dt>
              <dd>{entry.active_count.toLocaleString("en-US")}</dd>
            </div>
          )}
        </dl>
      )}

      {entry.top_player && (
        <p className="lb2-top">
          <span className="lb2-top-label">Top earner</span>
          <Link
            href={entityPath("players", entry.top_player.id, entry.top_player.name)}
            className="lb2-raise lb2-top-name"
          >
            {entry.top_player.name}
          </Link>
          <span className="lb2-top-gp">{entry.top_player.loot.value_formatted}</span>
        </p>
      )}
    </article>
  );
}

export function PlayerCard({
  entry,
  leader,
  podium,
  flash,
}: Omit<CardProps, "phrase"> & { flash?: boolean }) {
  const href = entityPath("players", entry.id, entry.name);
  return (
    <article
      className="lb2-card"
      data-size={podium ? "lg" : undefined}
      data-podium={podium ? entry.rank : undefined}
      data-hit={flash ? "true" : undefined}
    >
      <Link href={href} className="lb2-card-link" aria-label={`${entry.name}, rank ${entry.rank}`} />
      <header className="lb2-card-head">
        <Rank rank={entry.rank} />
        {entry.badges?.length ? (
          <span className="lb2-raise lb2-badges">
            <PlayerBadgeIcons badges={entry.badges} max={podium ? 4 : 3} />
          </span>
        ) : null}
      </header>

      <div className="lb2-ident">
        <NameTile name={entry.name} size="lg" className="lb2-icon lb2-avatar" playerId={entry.id} />
        <div className="lb2-ident-text">
          <h3 className="lb2-name">{entry.name}</h3>
          {entry.groups?.length ? (
            <p className="lb2-clans">
              {entry.groups.slice(0, podium ? 3 : 2).map((g) => (
                <Link
                  key={g.id}
                  href={entityPath("groups", g.id, g.name) as Route}
                  className="lb2-raise lb2-clan"
                >
                  {g.name}
                </Link>
              ))}
              {entry.groups.length > (podium ? 3 : 2) && (
                <span className="lb2-clan-more">+{entry.groups.length - (podium ? 3 : 2)}</span>
              )}
            </p>
          ) : (
            <p className="lb2-desc">No clan</p>
          )}
        </div>
      </div>

      <Loot value={entry.loot.value} formatted={entry.loot.value_formatted} delta={entry.delta} />
      <Bar value={entry.loot.value} leader={leader} />
    </article>
  );
}
