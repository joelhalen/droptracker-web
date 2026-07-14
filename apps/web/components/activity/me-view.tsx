"use client";

/**
 * "Me" tab — the signed-in user's Discord-oriented profile, assembled by the
 * shared useMyProfile() aggregate (see lib/activity/use-my-profile.ts). On
 * desktop-width iframes the sections split into two columns: identity /
 * accounts / groups / badges on the left, the achievement feed on the right.
 */
import type { Submission } from "@droptracker/api-types";
import { Badge, Card, NameTile, StatTile } from "@/components/ui";
import { PlayerBadgeList } from "@/components/player-badges";
import { CountUp } from "@/components/count-up";
import { formatGp } from "@/lib/format";
import { gpAmount } from "@/lib/activity/money";
import { useActivityAuth } from "@/lib/activity/auth-context";
import { useActivityNav } from "@/lib/activity/nav";
import { useMyProfile } from "@/lib/activity/use-my-profile";
import { discordAvatar } from "@/lib/activity/img";
import {
  ErrorNote,
  ExternalButton,
  LoadingBlock,
  SectionHeading,
  SubmissionRow,
} from "@/components/activity/bits";

export function MeView() {
  const { sessionToken, user } = useActivityAuth();
  const nav = useActivityNav();
  const { me, recent, badges, totalLoot, bestRank, loading, failed } = useMyProfile();

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
  const shownRecent: Submission[] = recent.slice(0, 10);

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

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6">
        <div>
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

          {badges.length > 0 && (
            <div>
              <SectionHeading>Badge case</SectionHeading>
              <Card padding="p-3.5">
                <PlayerBadgeList badges={badges.slice(0, 8)} />
              </Card>
            </div>
          )}
        </div>

        {shownRecent.length > 0 && (
          <div>
            <SectionHeading>Recent achievements</SectionHeading>
            <Card padding="p-0">
              {shownRecent.map((s, i) => (
                <SubmissionRow key={`${s.type}-${s.id}-${i}`} submission={s} />
              ))}
            </Card>
          </div>
        )}
      </div>

      <ExternalButton href="https://www.droptracker.io/dashboard">
        Dashboard & settings on droptracker.io
      </ExternalButton>
    </div>
  );
}
