import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { CountUp } from "@/components/count-up";
import { LootTracker } from "@/components/loot-tracker";
import { PlayerBadgeList } from "@/components/player-badges";
import { BossActivityList, PersonalBestsShowcase } from "@/components/profile-stats";
import { SubmissionList } from "@/components/submission-list";
import { Badge, Card, EntityChip, NameTile, StatTile } from "@/components/ui";

export const revalidate = 30;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  try {
    const player = await api.player(Number(id));
    return {
      title: player.name,
      description: `${player.name} — total loot ${player.total_loot?.value_formatted ?? "?"}, global rank ${player.global_rank ?? "?"}.`,
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
  const playerId = Number(id);
  if (!Number.isFinite(playerId)) notFound();
  const player = await orNotFound(api.player(playerId));
  // Loot tracker is non-critical: render the profile even if it fails.
  const loot = await api.playerLoot(playerId).catch(() => null);

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

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

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
              {player.is_supporter && (
                <Badge tone="gold" title="This player supports DropTracker">
                  ★ Supporter
                </Badge>
              )}
            </h1>
            <p className="text-osrs-parchment-dark/80 text-sm">Old School RuneScape player</p>
          </div>
        </div>
        <div className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Monthly loot"
            value={
              player.total_loot ? (
                <CountUp value={player.total_loot.value} formatted={player.total_loot.value_formatted} />
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
            value={<CountUp value={player.points ?? 0} formatted={(player.points ?? 0).toLocaleString()} />}
          />
          <StatTile label="Top NPC" value={player.top_npc ?? "—"} />
        </div>
      </header>

      {player.badges && player.badges.length > 0 && (
        <section className="rise-in">
          <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Badges</h2>
          <Card padding="p-5">
            <PlayerBadgeList badges={player.badges} />
          </Card>
        </section>
      )}

      {hasPbs && (
        <section className="rise-in">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="heading-rule text-osrs-gold flex-1 pb-1 text-lg font-semibold">
              Personal bests
            </h2>
            <Badge tone="sky">{player.personal_bests!.length} bosses</Badge>
          </div>
          <PersonalBestsShowcase pbs={player.personal_bests!} />
        </section>
      )}

      {loot && (
        <section className="rise-in">
          <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
            Loot tracker
          </h2>
          <LootTracker playerId={playerId} initial={loot} />
        </section>
      )}

      <div className="grid gap-8 md:grid-cols-3">
        <section className="rise-in min-w-0 md:col-span-2">
          <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Recent submissions</h2>
          <SubmissionList submissions={player.recent_submissions} />
        </section>

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
                    <EntityChip href={`/groups/${g.id}`} name={g.name} size="sm" />
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
