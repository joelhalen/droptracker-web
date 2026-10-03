"use client";

/**
 * Player profile for the activity. Mirrors the site profile: the same account
 * showcase (character model beside the Loot, Submissions, Collection Log,
 * Combat Achievements and Diaries tabs), the same personal-best cards with
 * their gear, top bosses and groups.
 *
 * The showcase and PB grid are the site's own components, mounted with their
 * iframe injections (same-origin `/img`, no site links, SDK-opened external
 * links) so a change to the site profile lands here too.
 */
import { useCallback, useEffect, useState } from "react";
import type { PlayerProfile } from "@droptracker/api-types";
import { Badge, Card, NameTile, StatTile } from "@/components/ui";
import { ProfileBadgeIcons } from "@/components/player-badges";
import { ProfileShowcase, type ProfileShowcaseEmbed } from "@/components/profile-showcase";
import { PersonalBestsGrid } from "@/components/personal-bests-grid";
import { CountUp } from "@/components/count-up";
import { gpAmount, gpText } from "@/lib/activity/money";
import { playerAccount, playerProfile, type PlayerAccount } from "@/lib/activity/api";
import { openExternal } from "@/lib/activity/discord-sdk";
import { externalUrl, SITE_ORIGIN } from "@/lib/activity/external-url";
import { momDelta, percentileHint } from "@/lib/player-profile";
import { AccountTypeBadge } from "@/components/account-type-badge";
import { useActivityNav } from "@/lib/activity/nav";
import {
  BackBar,
  BossMeters,
  EmptyNote,
  ErrorNote,
  ExternalButton,
  LoadingBlock,
  SectionHeading,
  SubmissionRow,
} from "@/components/activity/bits";

/** An account read that failed outright still shows the showcase, with every
 * tab in its empty state, exactly as the site does when its reads fail. */
const NO_ACCOUNT: PlayerAccount = { collection_log: null, achievements: null, loot: null };

export function PlayerView({ id }: { id: number }) {
  const nav = useActivityNav();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [account, setAccount] = useState<PlayerAccount | null>(null);
  const [failed, setFailed] = useState<"missing" | "error" | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setAccount(null);
    setFailed(null);
    playerProfile(id)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((err: { status?: number }) => {
        if (!cancelled) setFailed(err?.status === 404 ? "missing" : "error");
      });
    // Separate read: the hero and stats need not wait on a collection log.
    playerAccount(id)
      .then((a) => {
        if (!cancelled) setAccount(a);
      })
      .catch(() => {
        if (!cancelled) setAccount(NO_ACCOUNT);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const openScreenshot = useCallback((url: string) => {
    const href = externalUrl(url);
    if (href) void openExternal(href);
  }, []);

  if (failed) {
    return (
      <div>
        <BackBar title="Player" onBack={nav.pop} />
        <ErrorNote>
          {failed === "missing"
            ? "This player isn't tracked (or is hidden)."
            : "Couldn't load this profile."}
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

  const embed: ProfileShowcaseEmbed = {
    loot: { imgBase: "/img", links: false },
    onOpenScreenshot: openScreenshot,
    renderSubmissions: (subs) =>
      subs.length ? (
        <div className="-mx-3 -my-3">
          {subs.map((s) => (
            <SubmissionRow key={`${s.type}-${s.id}`} submission={s} />
          ))}
        </div>
      ) : (
        <EmptyNote>No recent submissions.</EmptyNote>
      ),
  };

  const pctHint = percentileHint(profile.global_rank, profile.ranked_players);
  const delta = momDelta(profile.total_loot?.value, profile.previous_month_loot?.value);
  const pbs = profile.personal_bests ?? [];
  const bosses = profile.top_bosses ?? [];

  return (
    <div>
      <BackBar title={profile.name} onBack={nav.pop} />

      <Card padding="p-4">
        <div className="flex items-center gap-3">
          <NameTile name={profile.name} size="lg" playerId={id} />
          <div className="min-w-0 flex-1">
            {/* Account type sits with the name, as it does in game and on the
                site. Icons are same-origin under /account-types, so the
                iframe CSP is happy; normal accounts render nothing. */}
            <p
              className={`flex min-w-0 items-center gap-1.5 font-serif text-lg font-semibold ${
                profile.is_supporter
                  ? "from-osrs-gold via-osrs-gold-bright to-osrs-gold bg-gradient-to-r bg-clip-text text-transparent"
                  : "text-osrs-gold"
              }`}
            >
              <span className="truncate">{profile.name}</span>
              <AccountTypeBadge type={profile.account_type} size="sm" />
            </p>
            <p className="text-osrs-parchment-dark/55 text-[11.5px]">Old School RuneScape player</p>
          </div>
          {profile.is_supporter && (
            <Badge variant="gold" title="This player supports DropTracker">
              ★ Supporter
            </Badge>
          )}
        </div>
        {/* The recap is generated on first view, so this is how most players
            find out they have one. It lives on the site, outside Discord. */}
        <button
          type="button"
          onClick={() => void openExternal(`${SITE_ORIGIN}/players/${profile.id}/recap`)}
          className="border-osrs-bronze/40 hover:border-osrs-gold text-osrs-parchment-dark hover:text-osrs-gold-bright mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors"
        >
          Monthly recap
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
        </button>
      </Card>

      <div className="mt-3">
        {account ? (
          <ProfileShowcase
            playerId={profile.id}
            modelFingerprint={profile.model_fingerprint}
            modelHasPet={profile.model_has_pet}
            collectionLog={account.collection_log}
            achievements={account.achievements}
            loot={account.loot}
            submissions={profile.recent_submissions}
            embed={embed}
            badges={
              profile.badges && profile.badges.length > 0 ? (
                <ProfileBadgeIcons badges={profile.badges} />
              ) : null
            }
            stats={
              <div className="space-y-2">
                <StatTile
                  label="Monthly loot"
                  value={
                    profile.total_loot ? (
                      <CountUp
                        value={gpAmount(profile.total_loot)}
                        formatted={gpText(profile.total_loot)}
                      />
                    ) : (
                      "—"
                    )
                  }
                  hint={delta?.text}
                />
                <StatTile
                  label="Global rank"
                  value={
                    profile.global_rank != null ? `#${profile.global_rank.toLocaleString()}` : "—"
                  }
                  hint={pctHint}
                />
                <StatTile
                  label="Points"
                  value={
                    <CountUp
                      value={profile.points ?? 0}
                      formatted={(profile.points ?? 0).toLocaleString()}
                    />
                  }
                />
                <StatTile
                  label="Top NPC"
                  value={
                    <span className="text-lg leading-snug font-semibold">
                      {profile.top_npc ?? "—"}
                    </span>
                  }
                />
              </div>
            }
          />
        ) : (
          <LoadingBlock rows={6} />
        )}
      </div>

      {pbs.length > 0 && (
        <div>
          <SectionHeading>Personal bests · {pbs.length}</SectionHeading>
          <PersonalBestsGrid
            pbs={pbs}
            imgBase="/img"
            onOpenBoss={(pb) => nav.push({ name: "pb-board", npcId: pb.npc_id, bossName: pb.boss })}
          />
        </div>
      )}

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6">
        {bosses.length > 0 && (
          <div>
            <SectionHeading>Top bosses this month</SectionHeading>
            <Card padding="p-3.5">
              <BossMeters bosses={bosses} max={bosses.length} />
            </Card>
          </div>
        )}

        <div>
          <SectionHeading>Groups</SectionHeading>
          {profile.groups.length > 0 ? (
            <Card padding="p-1.5">
              {profile.groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => nav.push({ name: "group", id: g.id })}
                  className="hover:bg-osrs-surface-2/60 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left"
                >
                  <NameTile name={g.name} size="sm" />
                  <span className="text-osrs-parchment min-w-0 flex-1 truncate text-[13px]">
                    {g.name}
                  </span>
                  {g.flair?.tier_name && <Badge variant="bronze">{g.flair.tier_name}</Badge>}
                </button>
              ))}
            </Card>
          ) : (
            <EmptyNote>Not in any groups.</EmptyNote>
          )}
        </div>
      </div>

      <ExternalButton href={`${SITE_ORIGIN}/players/${profile.id}`}>
        Open this profile on droptracker.io
      </ExternalButton>
    </div>
  );
}
