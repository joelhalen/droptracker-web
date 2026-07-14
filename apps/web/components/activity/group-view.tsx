"use client";

/**
 * Lean group profile: hero + stats, top members, boss meters, PB records,
 * recent activity; depth defers to droptracker.io.
 */
import { useEffect, useState } from "react";
import type { GroupProfile } from "@droptracker/api-types";
import { Card, NameTile, RankMedal, StatTile } from "@/components/ui";
import { CountUp } from "@/components/count-up";
import { LocalTime } from "@/components/local-time";
import { gpAmount, gpText } from "@/lib/activity/money";
import { groupProfile } from "@/lib/activity/api";
import { useActivityNav } from "@/lib/activity/nav";
import {
  BackBar,
  BossMeters,
  ErrorNote,
  ExternalButton,
  LoadingBlock,
  SectionHeading,
  SubmissionRow,
} from "@/components/activity/bits";

export function GroupView({ id }: { id: number }) {
  const nav = useActivityNav();
  const [profile, setProfile] = useState<GroupProfile | null>(null);
  const [failed, setFailed] = useState<"missing" | "error" | null>(null);

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
            <p className="text-osrs-gold truncate font-serif text-lg font-semibold">{profile.name}</p>
            {profile.description && (
              <p className="text-osrs-parchment-dark/60 line-clamp-2 text-[11.5px]">{profile.description}</p>
            )}
          </div>
        </div>
      </Card>

      <div className="mt-2.5 grid grid-cols-3 gap-2">
        <StatTile
          label="Loot (month)"
          value={
            <CountUp value={gpAmount(profile.monthly_loot)} formatted={gpText(profile.monthly_loot)} />
          }
        />
        <StatTile label="Global rank" value={profile.global_rank ? `#${profile.global_rank.toLocaleString()}` : "—"} />
        <StatTile label="Members" value={profile.member_count.toLocaleString()} />
      </div>

      {profile.top_players && profile.top_players.length > 0 && (
        <div>
          <SectionHeading>Top members this month</SectionHeading>
          <Card padding="p-1.5">
            {profile.top_players.slice(0, 6).map((p) => (
              <button
                key={p.id}
                onClick={() => nav.push({ name: "player", id: p.id })}
                className="hover:bg-osrs-surface-2/60 flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left"
              >
                <RankMedal rank={p.rank} />
                <NameTile name={p.name} size="sm" />
                <span className="text-osrs-parchment min-w-0 flex-1 truncate text-[13px]">{p.name}</span>
                <span className="text-osrs-gold-bright shrink-0 text-[12.5px] font-semibold tabular-nums">
                  {gpText(p.loot)}
                </span>
              </button>
            ))}
          </Card>
        </div>
      )}

      {profile.top_bosses && profile.top_bosses.length > 0 && (
        <div>
          <SectionHeading>Boss activity</SectionHeading>
          <Card padding="p-3.5">
            <BossMeters bosses={profile.top_bosses} />
          </Card>
        </div>
      )}

      {profile.records && profile.records.length > 0 && (
        <div>
          <SectionHeading>Records held</SectionHeading>
          <Card padding="p-1.5">
            {profile.records.slice(0, 6).map((r) => (
              <button
                key={`${r.npc_id}-${r.team_size}`}
                onClick={() => nav.push({ name: "pb-board", npcId: r.npc_id, bossName: r.boss })}
                className="hover:bg-osrs-surface-2/60 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-osrs-parchment block truncate text-[13px]">{r.boss}</span>
                  <span className="text-osrs-parchment-dark/50 block truncate text-[10.5px]">
                    {r.holder.name} · {r.team_size} · <LocalTime unix={r.date_ts} mode="date" />
                  </span>
                </span>
                <span className="text-osrs-gold-bright shrink-0 text-[13px] font-semibold tabular-nums">
                  {r.time_display}
                </span>
              </button>
            ))}
          </Card>
        </div>
      )}

      {profile.recent_submissions.length > 0 && (
        <div>
          <SectionHeading>Recent activity</SectionHeading>
          <Card padding="p-0">
            {profile.recent_submissions.slice(0, 8).map((s) => (
              <SubmissionRow
                key={`${s.type}-${s.id}`}
                submission={s}
                onPlayer={(pid) => nav.push({ name: "player", id: pid })}
              />
            ))}
          </Card>
        </div>
      )}

      <ExternalButton href={`https://www.droptracker.io/groups/${profile.id}`}>
        Full group page & lootboard on droptracker.io
      </ExternalButton>
    </div>
  );
}
