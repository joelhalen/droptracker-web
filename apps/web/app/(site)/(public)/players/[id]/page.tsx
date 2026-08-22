import type { Metadata, Route } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { entityPath } from "@/lib/slug";
import { orNotFound } from "@/lib/fetch";
import { resolveRef } from "@/lib/entity-ref";
import { entityCanonical } from "@/lib/seo";
import { AccountTypeBadge } from "@/components/account-type-badge";
import { EntityDisambiguation } from "@/components/entity-disambiguation";
import { CountUp } from "@/components/count-up";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { ProfileBadgeIcons } from "@/components/player-badges";
import { ProfileShowcase } from "@/components/profile-showcase";
import { PersonalBestsGrid } from "@/components/personal-bests-grid";
import { BossActivityList } from "@/components/profile-stats";
import { Badge, Card, EntityChip, NameTile, StatTile } from "@/components/ui";
import { SOON_BADGE, SOON_TITLE, STATE_SYNC_RELEASED } from "@/lib/plugin-features";

export const revalidate = 30;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const ref = await resolveRef("player", id).catch(() => null);
  if (!ref || ref.ambiguous) return { title: "Player" };
  try {
    const player = await api.player(ref.id);
    return {
      title: player.name,
      description: `${player.name} — total loot ${player.total_loot?.value_formatted ?? "?"}, global rank ${player.global_rank ?? "?"}.`,
      alternates: entityCanonical("players", player.id, player.canonical_slug),
    };
  } catch {
    return { title: "Player" };
  }
}

/** "Top 3%" style hint for the global-rank tile; only when meaningfully high. */
function percentileHint(rank?: number, ranked?: number): string | undefined {
  if (!rank || !ranked || ranked < 100) return undefined;
  const pct = (rank / ranked) * 100;
  if (pct > 50) return undefined;
  const display = pct < 1 ? Math.max(0.1, Math.round(pct * 10) / 10) : Math.ceil(pct);
  return `Top ${display}% of ${ranked.toLocaleString()} players`;
}

/** Month-over-month movement for the loot tile. */
function momDelta(current?: number, previous?: number): { text: string; up: boolean } | undefined {
  if (current == null || previous == null || previous <= 0) return undefined;
  const change = ((current - previous) / previous) * 100;
  if (!Number.isFinite(change) || Math.abs(change) < 1) return undefined;
  const rounded = Math.round(Math.abs(change));
  return { text: `${change > 0 ? "+" : "−"}${rounded}% vs last month`, up: change > 0 };
}

export default async function PlayerPage({ params }: { params: Params }) {
  const { id } = await params;
  const ref = await resolveRef("player", id);
  if (ref.ambiguous) {
    return (
      <EntityDisambiguation
        kind="players"
        slug={decodeURIComponent(id)}
        candidates={ref.candidates}
      />
    );
  }
  const playerId = ref.id;
  const player = await orNotFound(api.player(playerId));
  // Loot tracker is non-critical: render the profile even if it fails.
  const loot = await api.playerLoot(playerId).catch(() => null);
  // Both feed the showcase tabs. Non-critical like the loot tracker: a profile
  // must still render for the majority who have never synced.
  const [collectionLog, achievements] = await Promise.all([
    api.playerCollectionLog(playerId).catch(() => null),
    api.playerAchievements(playerId).catch(() => null),
  ]);

  // JSON-LD for richer search results (FRONTEND_PLAN.md §15 SEO).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: player.name,
    identifier: player.id,
  };

  const pctHint = percentileHint(player.global_rank, player.ranked_players);
  const delta = momDelta(player.total_loot?.value, player.previous_month_loot?.value);
  const hasBosses = (player.top_bosses?.length ?? 0) > 0;
  const hasPbs = (player.personal_bests?.length ?? 0) > 0;
  // The deep links are marked "Soon" only where the page behind them really is
  // empty. A profile synced from a dev build has a log to show, and pinning the
  // pill to the release alone would have labelled that page unreleased.
  const logSoon = !STATE_SYNC_RELEASED && !collectionLog?.has_synced;
  const achievementsSoon = !STATE_SYNC_RELEASED && !achievements?.has_synced;

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="rise-in space-y-5">
        <div className="flex items-center gap-4">
          <NameTile name={player.name} size="lg" />
          <div>
            <h1
              className={`flex flex-wrap items-center gap-2 text-3xl font-bold ${
                player.is_supporter
                  ? "bg-gradient-to-r from-osrs-gold via-osrs-gold-bright to-osrs-gold bg-clip-text text-transparent"
                  : "text-osrs-gold"
              }`}
            >
              {player.name}
              <AccountTypeBadge type={player.account_type} />
              {player.is_supporter && (
                <Badge variant="gold" title="This player supports DropTracker">
                  ★ Supporter
                </Badge>
              )}
            </h1>
            <p className="text-osrs-parchment-dark/80 text-sm">Old School RuneScape player</p>
          </div>
          {/* The recap is generated on first view, so this link is the only way
              most players will ever discover they have one. */}
          <div className="ml-auto flex shrink-0 flex-wrap gap-2">
            <Link
              href={`/players/${player.id}/collection-log` as Route}
              className="border-osrs-bronze/40 hover:border-osrs-gold text-osrs-parchment-dark hover:text-osrs-gold-bright inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors"
            >
              Collection log
              {logSoon && (
                <Badge variant="neutral" size="sm" title={SOON_TITLE}>
                  {SOON_BADGE}
                </Badge>
              )}
            </Link>
            <Link
              href={`/players/${player.id}/achievements` as Route}
              className="border-osrs-bronze/40 hover:border-osrs-gold text-osrs-parchment-dark hover:text-osrs-gold-bright inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors"
            >
              Achievements
              {achievementsSoon && (
                <Badge variant="neutral" size="sm" title={SOON_TITLE}>
                  {SOON_BADGE}
                </Badge>
              )}
            </Link>
            <Link
              href={`/players/${player.id}/recap` as Route}
              className="border-osrs-bronze/40 hover:border-osrs-gold text-osrs-parchment-dark hover:text-osrs-gold-bright rounded-lg border px-3 py-1.5 text-sm transition-colors"
            >
              Monthly recap
            </Link>
          </div>
        </div>
      </header>

      {/* Character beside the account tabs — collection log, combat
          achievements and diaries in the place you already are, instead of
          three separate pages. */}
      <ProfileShowcase
        playerId={player.id}
        modelFingerprint={player.model_fingerprint}
        modelHasPet={player.model_has_pet}
        collectionLog={collectionLog}
        achievements={achievements}
        loot={loot}
        submissions={player.recent_submissions}
        badges={
          player.badges && player.badges.length > 0 ? (
            <ProfileBadgeIcons badges={player.badges} />
          ) : null
        }
        stats={
          /* One tile per row. StatTile already draws its own surface, so the
             wrapping card was a box inside a box — and two columns inside the
             character rail left each value about 100px, enough to wrap a boss
             name like "Chamber of Xeric Challenge Mode" over five lines. */
          <div className="space-y-2">
            <StatTile
              label="Monthly loot"
              value={
                player.total_loot ? (
                  <CountUp
                    value={player.total_loot.value}
                    formatted={player.total_loot.value_formatted}
                  />
                ) : (
                  "—"
                )
              }
              hint={delta?.text}
            />
            <StatTile
              label="Global rank"
              value={player.global_rank != null ? `#${player.global_rank}` : "—"}
              hint={pctHint}
            />
            <StatTile
              label="Points"
              value={
                <CountUp
                  value={player.points ?? 0}
                  formatted={(player.points ?? 0).toLocaleString()}
                />
              }
            />
            {/* A boss name is prose, not a figure: the tile's number-sized type
                is why this one alone kept wrapping. */}
            <StatTile
              label="Top NPC"
              value={
                <span className="text-lg leading-snug font-semibold">{player.top_npc ?? "—"}</span>
              }
            />
          </div>
        }
      />

      {hasPbs && (
        <section className="rise-in">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="heading-rule text-osrs-gold flex-1 pb-1 text-lg font-semibold">
              Personal bests
            </h2>
            <Badge variant="sky">{player.personal_bests!.length} bosses</Badge>
          </div>
          <PersonalBestsGrid pbs={player.personal_bests!} />
        </section>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        <aside className="min-w-0 space-y-6">
          {hasBosses && (
            <div className="rise-in">
              <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
                Top bosses this month
              </h2>
              <Card padding="p-4">
                <BossActivityList bosses={player.top_bosses!} />
              </Card>
            </div>
          )}
          <div className="rise-in">
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Groups</h2>
            {player.groups.length ? (
              <ul className="space-y-2.5 text-sm">
                {player.groups.map((g) => (
                  <li key={g.id}>
                    <EntityHoverCard kind="group" id={g.id} name={g.name} className="flex min-w-0">
                      <EntityChip
                        href={entityPath("groups", g.id, g.name)}
                        name={g.name}
                        size="sm"
                        flair={g.flair?.style}
                        flairTitle={g.flair?.tier_name}
                      />
                    </EntityHoverCard>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-osrs-parchment-dark/60 text-sm">Not in any groups.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
