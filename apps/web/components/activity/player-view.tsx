"use client";

/**
 * Lean player profile for the activity: hero + stat tiles, boss meters,
 * personal bests, recent drops/clogs/PBs, badges. Depth (loot tracker,
 * full history) defers to droptracker.io.
 */
import { useEffect, useState } from "react";
import type { PlayerProfile } from "@droptracker/api-types";
import { Badge, Card, NameTile, StatTile } from "@/components/ui";
import { PlayerBadgeList } from "@/components/player-badges";
import { CountUp } from "@/components/count-up";
import { gpAmount, gpText } from "@/lib/activity/money";
import { playerProfile } from "@/lib/activity/api";
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

export function PlayerView({ id }: { id: number }) {
  const nav = useActivityNav();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [failed, setFailed] = useState<"missing" | "error" | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setFailed(null);
    playerProfile(id)
      .then((p) => {
        if (!cancelled) setProfile(p);
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
        <BackBar title="Player" onBack={nav.pop} />
        <ErrorNote>
          {failed === "missing" ? "This player isn't tracked (or is hidden)." : "Couldn't load this profile."}
        </ErrorNote>
      </div>
    );
  }
  if (!profile) {
    return (
      <div>
        <BackBar title="Player" onBack={nav.pop} />
        <LoadingBlock rows={5} />
      </div>
    );
  }

  return (
    <div>
      <BackBar title={profile.name} onBack={nav.pop} />

      <Card padding="p-4">
        <div className="flex items-center gap-3">
          <NameTile name={profile.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-osrs-gold truncate font-serif text-lg font-semibold">{profile.name}</p>
            <p className="text-osrs-parchment-dark/55 text-[11.5px]">
              {profile.top_npc ? `Mostly farming ${profile.top_npc}` : "Tracked player"}
            </p>
            {profile.groups.length > 0 && (
              <span className="mt-1.5 flex flex-wrap gap-1">
                {profile.groups.slice(0, 3).map((g) => (
                  <button key={g.id} onClick={() => nav.push({ name: "group", id: g.id })}>
                    <Badge tone="bronze">{g.name}</Badge>
                  </button>
                ))}
              </span>
            )}
          </div>
          {profile.is_supporter && <Badge tone="ember">Supporter</Badge>}
        </div>
      </Card>

      <div className="mt-2.5 grid grid-cols-3 gap-2">
        <StatTile
          label="Loot (month)"
          value={<CountUp value={gpAmount(profile.total_loot)} formatted={gpText(profile.total_loot)} />}
        />
        <StatTile label="Global rank" value={profile.global_rank ? `#${profile.global_rank.toLocaleString()}` : "—"} />
        <StatTile label="Points" value={(profile.points ?? 0).toLocaleString()} />
      </div>

      {profile.top_bosses && profile.top_bosses.length > 0 && (
        <div>
          <SectionHeading>Top bosses this month</SectionHeading>
          <Card padding="p-3.5">
            <BossMeters bosses={profile.top_bosses} />
          </Card>
        </div>
      )}

      {profile.personal_bests && profile.personal_bests.length > 0 && (
        <div>
          <SectionHeading>Personal bests</SectionHeading>
          <Card padding="p-1.5">
            {profile.personal_bests.slice(0, 6).map((pb) => (
              <button
                key={`${pb.npc_id}-${pb.team_size}`}
                onClick={() => nav.push({ name: "pb-board", npcId: pb.npc_id, bossName: pb.boss })}
                className="hover:bg-osrs-surface-2/60 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left"
              >
                <span className="text-osrs-parchment min-w-0 flex-1 truncate text-[13px]">{pb.boss}</span>
                <span className="text-osrs-parchment-dark/50 shrink-0 text-[10.5px]">{pb.team_size}</span>
                <span className="text-osrs-gold-bright shrink-0 text-[13px] font-semibold tabular-nums">
                  {pb.time_display}
                </span>
              </button>
            ))}
          </Card>
        </div>
      )}

      {profile.recent_submissions.length > 0 && (
        <div>
          <SectionHeading>Recent</SectionHeading>
          <Card padding="p-0">
            {profile.recent_submissions.slice(0, 8).map((s) => (
              <SubmissionRow key={`${s.type}-${s.id}`} submission={s} />
            ))}
          </Card>
        </div>
      )}

      {profile.badges && profile.badges.length > 0 && (
        <div>
          <SectionHeading>Badges</SectionHeading>
          <Card padding="p-3.5">
            <PlayerBadgeList badges={profile.badges} />
          </Card>
        </div>
      )}

      <ExternalButton href={`https://www.droptracker.io/players/${profile.id}`}>
        Full profile & loot tracker on droptracker.io
      </ExternalButton>
    </div>
  );
}
