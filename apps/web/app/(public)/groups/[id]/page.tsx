import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { CountUp } from "@/components/count-up";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { BossActivityList, RecordsShowcase, TopPlayersList } from "@/components/profile-stats";
import { SubmissionList } from "@/components/submission-list";
import { Card, EmptyState, EntityChip, NameTile, StatTile, TierBadge } from "@/components/ui";

export const revalidate = 30;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  try {
    const group = await api.group(Number(id));
    return {
      title: group.name,
      description: group.description ?? `${group.name} — ${group.member_count} members.`,
    };
  } catch {
    return { title: "Group" };
  }
}

export default async function GroupPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();
  const group = await orNotFound(api.group(groupId));

  const hasTopPlayers = (group.top_players?.length ?? 0) > 0;
  const hasBosses = (group.top_bosses?.length ?? 0) > 0;
  const hasRecords = (group.records?.length ?? 0) > 0;

  return (
    <div className="space-y-8">
      <header className="rise-in flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <NameTile name={group.name} size="lg" flair={group.flair?.style} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-osrs-gold text-3xl font-bold">{group.name}</h1>
              {group.flair && (
                <TierBadge tierKey={group.flair.tier_key} name={group.flair.tier_name} />
              )}
            </div>
            {group.description && (
              <p className="text-osrs-parchment-dark/80 max-w-2xl">{group.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/groups/${group.id}/lootboard`}
            className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1.5 text-sm font-medium"
          >
            Lootboard
          </Link>
          <Link
            href={`/groups/${group.id}/points/leaderboard` as Route}
            className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1.5 text-sm font-medium"
          >
            Points
          </Link>
          {group.discord_url && (
            <a
              href={group.discord_url}
              className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium"
            >
              Join Discord
            </a>
          )}
        </div>
      </header>

      <div className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Members"
          value={<CountUp value={group.member_count} formatted={group.member_count.toLocaleString()} />}
        />
        <StatTile label="Global rank" value={`#${group.global_rank ?? "—"}`} />
        <StatTile
          label="Monthly loot"
          value={
            group.monthly_loot ? (
              <CountUp value={group.monthly_loot.value} formatted={group.monthly_loot.value_formatted} />
            ) : (
              "—"
            )
          }
        />
        <div className="bg-osrs-surface-2/70 rounded-lg px-4 py-3">
          <div className="text-osrs-parchment-dark/60 text-xs tracking-wide uppercase">
            Top player
          </div>
          {group.top_player ? (
            <EntityHoverCard
              kind="player"
              id={group.top_player.id}
              name={group.top_player.name}
              className="flex min-w-0"
            >
              <EntityChip
                href={`/players/${group.top_player.id}`}
                name={group.top_player.name}
                size="sm"
                className="mt-1.5"
                subtitle={group.top_player.total_loot?.value_formatted}
              />
            </EntityHoverCard>
          ) : (
            <div className="text-osrs-gold-bright mt-0.5 text-2xl font-bold">—</div>
          )}
        </div>
      </div>

      {hasRecords && (
        <section className="rise-in">
          <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
            Clan records
          </h2>
          <p className="text-osrs-parchment-dark/60 mb-3 -mt-2 text-sm">
            Fastest kill times held by members of this clan.
          </p>
          <RecordsShowcase records={group.records!} />
        </section>
      )}

      {(hasTopPlayers || hasBosses) && (
        <div className="grid gap-8 md:grid-cols-2">
          <section className="rise-in min-w-0">
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
              Top players this month
            </h2>
            <Card padding="p-4">
              {hasTopPlayers ? (
                <TopPlayersList players={group.top_players!} />
              ) : (
                <EmptyState
                  title="No tracked loot yet this month"
                  hint="Member rankings appear once loot starts coming in."
                />
              )}
            </Card>
          </section>
          <section className="rise-in">
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
              Most active bosses
            </h2>
            <Card padding="p-4">
              {hasBosses ? (
                <BossActivityList bosses={group.top_bosses!} />
              ) : (
                <EmptyState
                  title="No boss activity yet this month"
                  hint="The clan's most-farmed bosses will show up here."
                />
              )}
            </Card>
          </section>
        </div>
      )}

      <section className="rise-in">
        <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Recent submissions</h2>
        <SubmissionList
          submissions={group.recent_submissions}
          showPlayer
          emptyHint="Tracked loot for this clan will appear here."
        />
      </section>
    </div>
  );
}
