"use client";

/**
 * "Me" tab — the signed-in user's Discord-oriented profile. There is no
 * per-user aggregate endpoint, so this assembles client-side: /me (bearer)
 * gives linked accounts + groups, then a fan-out to the anonymous player
 * profiles merges recent drops/clogs/PBs and badge history across accounts.
 */
import { useEffect, useMemo, useState } from "react";
import type { Me, PlayerProfile, Submission } from "@droptracker/api-types";
import { Badge, Card, NameTile, StatTile } from "@/components/ui";
import { PlayerBadgeList } from "@/components/player-badges";
import { CountUp } from "@/components/count-up";
import { formatGp } from "@/lib/format";
import { gpAmount } from "@/lib/activity/money";
import { activityMe, playerProfile } from "@/lib/activity/api";
import { useActivityAuth } from "@/lib/activity/auth-context";
import { useActivityNav } from "@/lib/activity/nav";
import { discordAvatar } from "@/lib/activity/img";
import {
  ErrorNote,
  ExternalButton,
  LoadingBlock,
  SectionHeading,
  SubmissionRow,
} from "@/components/activity/bits";

/** Fan-out cap — enough for multi-account users without hammering the BFF. */
const MAX_PROFILE_FETCHES = 3;

export function MeView() {
  const { sessionToken, user } = useActivityAuth();
  const nav = useActivityNav();

  const [me, setMe] = useState<Me | null>(null);
  const [profiles, setProfiles] = useState<PlayerProfile[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const meData = await activityMe(sessionToken);
        if (cancelled) return;
        setMe(meData);
        const targets = meData.players.slice(0, MAX_PROFILE_FETCHES);
        const results = await Promise.allSettled(targets.map((p) => playerProfile(p.id)));
        if (cancelled) return;
        setProfiles(
          results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
        );
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  const recent = useMemo<Submission[]>(
    () =>
      profiles
        .flatMap((p) =>
          p.recent_submissions.map((s) => ({ ...s, player_name: s.player_name ?? p.name })),
        )
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 10),
    [profiles],
  );
  const badges = useMemo(() => profiles.flatMap((p) => p.badges ?? []), [profiles]);
  const totalLoot = useMemo(
    () => (me?.players ?? []).reduce((sum, p) => sum + gpAmount(p.total_loot), 0),
    [me],
  );
  const bestRank = useMemo(() => {
    const ranks = (me?.players ?? [])
      .map((p) => p.global_rank)
      .filter((r): r is number => r != null);
    return ranks.length ? Math.min(...ranks) : null;
  }, [me]);

  if (!sessionToken) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
        <h1 className="text-osrs-gold font-serif text-xl font-semibold">Sign in to see your profile</h1>
        <p className="text-osrs-parchment-dark/70 max-w-xs text-sm">
          Approve the Discord sign-in prompt when the activity opens to see your accounts, loot,
          and achievements here.
        </p>
      </div>
    );
  }
  if (loading) return <LoadingBlock rows={6} />;
  if (failed || !me) return <ErrorNote>Couldn&apos;t load your profile — relaunch the activity.</ErrorNote>;

  const displayName = me.display_name ?? user?.global_name ?? user?.username ?? "You";

  return (
    <div>
      <Card padding="p-4">
        <div className="flex items-center gap-3">
          {/* Discord CDN is CSP-exempt inside activities. */}
          <img
            src={me.avatar_url ?? discordAvatar(me.discord_id, user?.avatar)}
            alt=""
            className="border-osrs-bronze/50 size-13 rounded-full border-2 object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-osrs-gold truncate font-serif text-lg font-semibold">{displayName}</p>
            <p className="text-osrs-parchment-dark/55 text-[11.5px]">
              {me.players.length} linked account{me.players.length === 1 ? "" : "s"}
              {me.groups.length > 0 && ` · ${me.groups[0]!.name}`}
            </p>
            {me.is_supporter && (
              <span className="mt-1 inline-block">
                <Badge tone="ember">Supporter</Badge>
              </span>
            )}
          </div>
        </div>
      </Card>

      <div className="mt-2.5 grid grid-cols-3 gap-2">
        <StatTile label="Loot (month)" value={<CountUp value={totalLoot} formatted={formatGp(totalLoot)} />} />
        <StatTile label="Best rank" value={bestRank ? `#${bestRank.toLocaleString()}` : "—"} />
        <StatTile label="Badges" value={badges.length.toLocaleString()} />
      </div>

      <SectionHeading>Your accounts</SectionHeading>
      {me.players.length === 0 ? (
        <ErrorNote>
          No OSRS accounts linked yet — claim your RSN with <code>/claim-rsn</code> in Discord or on
          the website.
        </ErrorNote>
      ) : (
        <Card padding="p-1.5">
          {me.players.map((p) => (
            <button
              key={p.id}
              onClick={() => nav.push({ name: "player", id: p.id })}
              className="hover:bg-osrs-surface-2/60 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left"
            >
              <NameTile name={p.name} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="text-osrs-parchment block truncate text-[13.5px] font-semibold">{p.name}</span>
                <span className="text-osrs-parchment-dark/55 block text-[11px]">
                  {formatGp(gpAmount(p.total_loot))} this month
                  {p.global_rank ? ` · global #${p.global_rank.toLocaleString()}` : ""}
                </span>
              </span>
              <span aria-hidden className="text-osrs-parchment-dark/40">
                ›
              </span>
            </button>
          ))}
        </Card>
      )}

      {me.groups.length > 0 && (
        <div>
          <SectionHeading>Your groups</SectionHeading>
          <div className="flex flex-wrap gap-1.5">
            {me.groups.map((g) => (
              <button key={g.id} onClick={() => nav.push({ name: "group", id: g.id })}>
                <Badge tone={g.role === "owner" ? "gold" : g.role === "admin" ? "ember" : "bronze"}>
                  {g.name}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <SectionHeading>Recent achievements</SectionHeading>
          <Card padding="p-0">
            {recent.map((s, i) => (
              <SubmissionRow key={`${s.type}-${s.id}-${i}`} submission={s} />
            ))}
          </Card>
        </div>
      )}

      {badges.length > 0 && (
        <div>
          <SectionHeading>Badge case</SectionHeading>
          <Card padding="p-3.5">
            <PlayerBadgeList badges={badges.slice(0, 8)} />
          </Card>
        </div>
      )}

      <ExternalButton href="https://www.droptracker.io/dashboard">
        Dashboard & settings on droptracker.io
      </ExternalButton>
    </div>
  );
}
