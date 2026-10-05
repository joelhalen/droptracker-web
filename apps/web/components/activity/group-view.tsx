"use client";

/**
 * Group profile for the Activity, with the site's sub-pages as tabs:
 * Overview (the site profile's stats, records, top players, bosses and recent
 * submissions, from the same components), Lootboard, Clan Log, Personal bests
 * and Points. Links inside the shared components open in-app through the
 * Activity's embed host.
 */
import { useEffect, useState } from "react";
import type { GroupProfile } from "@droptracker/api-types";
import { CountUp } from "@/components/count-up";
import { BossActivityList, RecordsShowcase, TopPlayersList } from "@/components/profile-stats";
import { SubmissionList } from "@/components/submission-list";
import { Card, EntityChip, NameTile, StatTile, TierBadge } from "@/components/ui";
import { gpAmount, gpText } from "@/lib/activity/money";
import { groupProfile } from "@/lib/activity/api";
import { openExternal } from "@/lib/activity/discord-sdk";
import { SITE_ORIGIN } from "@/lib/activity/external-url";
import { useActivityNav, type GroupTab } from "@/lib/activity/nav";
import {
  BackBar,
  EmptyNote,
  ErrorNote,
  ExternalButton,
  LoadingBlock,
  SectionHeading,
} from "@/components/activity/bits";
import {
  GroupClanLogTab,
  GroupLootboardTab,
  GroupPbsTab,
  GroupPointsTab,
} from "@/components/activity/group-tabs";

const TABS: { key: GroupTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "lootboard", label: "Lootboard" },
  { key: "clan-log", label: "Clan Log" },
  { key: "pbs", label: "Personal bests" },
  { key: "points", label: "Points" },
];

export function GroupView({ id, tab: initialTab }: { id: number; tab?: GroupTab }) {
  const nav = useActivityNav();
  const [profile, setProfile] = useState<GroupProfile | null>(null);
  const [failed, setFailed] = useState<"missing" | "error" | null>(null);
  const [tab, setTab] = useState<GroupTab>(initialTab ?? "overview");

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setFailed(null);
    groupProfile(id)
      .then((g) => {
        if (!cancelled) setProfile(g);
      })
      .catch((err: { status?: number }) => {
        if (!cancelled) setFailed(err?.status === 404 ? "missing" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (failed) {
    return (
      <div>
        <BackBar title="Group" onBack={nav.pop} />
        <ErrorNote>{failed === "missing" ? "This group doesn't exist." : "Couldn't load this group."}</ErrorNote>
      </div>
    );
  }
  if (!profile) {
    return (
      <div>
        <BackBar title="Group" onBack={nav.pop} />
        <LoadingBlock rows={5} />
      </div>
    );
  }

  return (
    <div>
      <BackBar title={profile.name} onBack={nav.pop} />

      <Card padding="p-4">
        <div className="flex items-center gap-3">
          {profile.icon_url ? (
            <img src={profile.icon_url} alt="" className="size-12 rounded-xl object-cover" />
          ) : (
            <NameTile name={profile.name} size="lg" flair={profile.flair?.style} />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="text-osrs-gold truncate font-serif text-lg font-semibold">{profile.name}</p>
              {profile.flair && (
                <TierBadge tierKey={profile.flair.tier_key} name={profile.flair.tier_name} />
              )}
            </div>
            {profile.description && (
              <p className="text-osrs-parchment-dark/60 line-clamp-2 text-[11.5px]">{profile.description}</p>
            )}
          </div>
        </div>
        {profile.discord_url && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void openExternal(profile.discord_url!)}
              className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark rounded-lg px-3 py-1.5 text-[12.5px] font-medium"
            >
              Join Discord
            </button>
          </div>
        )}
      </Card>

      <nav
        className="border-osrs-bronze/25 -mx-1 mt-3 flex gap-1 overflow-x-auto border-b px-1"
        aria-label="Group sections"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key}
            className={`shrink-0 border-b-2 px-3 py-2 text-[12.5px] whitespace-nowrap transition-colors ${
              tab === t.key
                ? "border-osrs-gold text-osrs-gold-bright font-semibold"
                : "text-osrs-parchment-dark/65 hover:text-osrs-gold-bright border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-3">
        {tab === "overview" && <GroupOverview profile={profile} onTab={setTab} />}
        {tab === "lootboard" && <GroupLootboardTab groupId={profile.id} />}
        {tab === "clan-log" && <GroupClanLogTab groupId={profile.id} />}
        {tab === "pbs" && <GroupPbsTab groupId={profile.id} />}
        {tab === "points" && <GroupPointsTab groupId={profile.id} groupName={profile.name} />}
      </div>

      <ExternalButton href={`${SITE_ORIGIN}/groups/${profile.id}`}>
        Open this group on droptracker.io
      </ExternalButton>
    </div>
  );
}

function GroupOverview({
  profile,
  onTab,
}: {
  profile: GroupProfile;
  onTab: (tab: GroupTab) => void;
}) {
  const records = profile.records ?? [];
  const topPlayers = profile.top_players ?? [];
  const bosses = profile.top_bosses ?? [];
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Members" value={profile.member_count.toLocaleString()} />
        <StatTile
          label="Global rank"
          value={profile.global_rank ? `#${profile.global_rank.toLocaleString()}` : "—"}
        />
        <StatTile
          label="Monthly loot"
          value={
            profile.monthly_loot ? (
              <CountUp value={gpAmount(profile.monthly_loot)} formatted={gpText(profile.monthly_loot)} />
            ) : (
              "—"
            )
          }
        />
        <div className="bg-osrs-surface-2/70 rounded-lg px-4 py-3">
          <div className="text-osrs-parchment-dark/60 text-xs tracking-wide uppercase">Top player</div>
          {profile.top_player ? (
            <EntityChip
              entity={{ kind: "player", id: profile.top_player.id, name: profile.top_player.name }}
              name={profile.top_player.name}
              size="sm"
              className="mt-1.5"
              subtitle={profile.top_player.total_loot?.value_formatted}
              playerId={profile.top_player.id}
            />
          ) : (
            <div className="text-osrs-gold-bright mt-0.5 text-2xl font-bold">—</div>
          )}
        </div>
      </div>

      {records.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <SectionHeading>Clan records</SectionHeading>
            <button
              type="button"
              onClick={() => onTab("pbs")}
              className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright shrink-0 text-[12px]"
            >
              All personal bests →
            </button>
          </div>
          <RecordsShowcase records={records} />
        </div>
      )}

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6">
        <div>
          <SectionHeading>Top players this month</SectionHeading>
          <Card padding="p-3.5">
            {topPlayers.length > 0 ? (
              <TopPlayersList players={topPlayers} />
            ) : (
              <EmptyNote>Member rankings appear once loot starts coming in.</EmptyNote>
            )}
          </Card>
        </div>
        <div>
          <SectionHeading>Most active bosses</SectionHeading>
          <Card padding="p-3.5">
            {bosses.length > 0 ? (
              <BossActivityList bosses={bosses} />
            ) : (
              <EmptyNote>The clan&apos;s most-farmed bosses will show up here.</EmptyNote>
            )}
          </Card>
        </div>
      </div>

      <SectionHeading>Recent submissions</SectionHeading>
      <Card padding="p-3">
        <SubmissionList
          submissions={profile.recent_submissions}
          showPlayer
          emptyHint="Tracked loot for this clan will appear here."
        />
      </Card>
    </div>
  );
}
