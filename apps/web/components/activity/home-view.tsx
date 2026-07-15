"use client";

/**
 * Activity home hub, oriented around the signed-in player (collection-log
 * style): a personal panel — identity, stat tiles, linked accounts, clan —
 * that sits as a left rail on desktop and stacks first on mobile, next to
 * the shared hub content (search, section cards, the player's latest
 * collections strip, and a live slice of the global feed).
 */
import { useEffect, useRef, useState } from "react";
import type { EventSummary, SearchResults, Submission } from "@droptracker/api-types";
import { Badge, Card, NameTile, Skeleton, StatTile } from "@/components/ui";
import { CountUp } from "@/components/count-up";
import { HoverCard, CardStatLine, CARD_SECTION_CLASS } from "@/components/hover-card";
import { useEventStream } from "@/lib/use-event-stream";
import { formatGp, formatRelativeTime } from "@/lib/format";
import { guildEvents, myEvents, recentFeed, searchAll } from "@/lib/activity/api";
import { toActivityFeedRow, type ActivityFeedRow } from "@/lib/activity/feed";
import { useActivityAuth } from "@/lib/activity/auth-context";
import { useActivityData } from "@/lib/activity/data-context";
import { useActivityNav } from "@/lib/activity/nav";
import { useMyProfile, type MyProfile } from "@/lib/activity/use-my-profile";
import { openExternal } from "@/lib/activity/discord-sdk";
import { discordAvatar } from "@/lib/activity/img";
import { gpAmount, gpText } from "@/lib/activity/money";
import { SectionHeading } from "@/components/activity/bits";

const SUBMISSION_KIND: Record<Submission["type"], string> = {
  drop: "Drop",
  clog: "Collection log",
  pb: "Personal best",
  ca: "Combat achievement",
  pet: "Pet",
  level: "Level",
  quest: "Quest",
};

const FEED_LIMIT = 6;

function NavCard({
  title,
  detail,
  live,
  icon,
  onPress,
}: {
  title: string;
  detail: string;
  live?: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <button
      onClick={onPress}
      className="border-osrs-bronze/30 bg-osrs-surface-1 hover:border-osrs-bronze/60 flex flex-col gap-1.5 rounded-2xl border p-3.5 text-left transition-colors"
    >
      <span className="text-osrs-gold" aria-hidden>
        {icon}
      </span>
      <span className="text-osrs-parchment font-serif text-[15px] font-semibold">{title}</span>
      <span className="text-osrs-parchment-dark/55 text-[11.5px] leading-snug">{detail}</span>
      {live && (
        <span className="text-osrs-green text-[10px] font-bold tracking-wider uppercase">
          ● {live}
        </span>
      )}
    </button>
  );
}

/**
 * The player-first panel: who you are, this month's numbers, and your
 * accounts. Anonymous viewers get a sign-in nudge instead; signed-in users
 * without a claimed RSN get the claim prompt.
 */
function PersonalPanel({ my }: { my: MyProfile }) {
  const { sessionToken, user } = useActivityAuth();
  const nav = useActivityNav();

  if (!sessionToken) {
    return (
      <Card padding="p-4">
        <p className="text-osrs-gold font-serif text-[15px] font-semibold">Your profile</p>
        <p className="text-osrs-parchment-dark/60 mt-1 text-[12px] leading-snug">
          Approve the Discord sign-in prompt when the activity opens to see your loot, ranks, and
          achievements here.
        </p>
      </Card>
    );
  }
  if (my.loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }
  if (my.failed || !my.me) {
    return (
      <Card padding="p-4">
        <p className="text-osrs-parchment-dark/60 text-[12px]">
          Couldn&apos;t load your profile — relaunch the activity.
        </p>
      </Card>
    );
  }

  const me = my.me;
  const displayName = me.display_name ?? user?.global_name ?? user?.username ?? "You";

  return (
    <div className="space-y-2.5">
      {/* Identity */}
      <Card padding="p-4" className="bg-gradient-to-br from-osrs-surface-2 to-osrs-surface-1">
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
          <button
            onClick={() => nav.setRoot({ name: "me" })}
            className="text-osrs-gold-bright border-osrs-bronze/40 shrink-0 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold"
          >
            Profile
          </button>
        </div>
      </Card>

      {/* This month's numbers */}
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="Loot (month)"
          value={<CountUp value={my.totalLoot} formatted={formatGp(my.totalLoot)} />}
        />
        <StatTile
          label="Best rank"
          value={my.bestRank ? `#${my.bestRank.toLocaleString()}` : "—"}
        />
        <StatTile label="Badges" value={my.badges.length.toLocaleString()} />
        <StatTile label="Accounts" value={me.players.length.toLocaleString()} />
      </div>

      {/* Linked accounts */}
      {me.players.length === 0 ? (
        <Card padding="p-3.5">
          <p className="text-osrs-parchment-dark/60 text-[12px] leading-snug">
            No OSRS accounts linked yet — claim your RSN with <code>/claim-rsn</code> in Discord or
            on the website.
          </p>
        </Card>
      ) : (
        <Card padding="p-1.5">
          {me.players.slice(0, 4).map((p) => (
            <button
              key={p.id}
              onClick={() => nav.push({ name: "player", id: p.id })}
              className="hover:bg-osrs-surface-2/60 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left"
            >
              <NameTile name={p.name} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="text-osrs-parchment block truncate text-[13.5px] font-semibold">
                  {p.name}
                </span>
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
    </div>
  );
}

/** One submission thumbnail wrapped in the shared site hover card. */
function SubmissionThumb({ s }: { s: Submission }) {
  const kind = SUBMISSION_KIND[s.type] ?? "Drop";
  const qty = s.quantity != null && s.quantity > 1 ? s.quantity : null;
  const worth = s.value && gpAmount(s.value) > 0 ? gpText(s.value) : null;
  return (
    <HoverCard
      className="shrink-0"
      content={
        <div className="p-3">
          <div className="flex items-center gap-2.5">
            {s.image_url ? (
              <img src={s.image_url} alt="" className="size-9 shrink-0 object-contain" />
            ) : (
              <span aria-hidden className="text-osrs-gold/70 w-9 text-center text-xl">
                ◆
              </span>
            )}
            <div className="min-w-0">
              <p className="text-osrs-parchment truncate text-[13px] font-semibold">
                {s.label}
                {qty && <span className="text-osrs-gold/80"> ×{qty.toLocaleString()}</span>}
              </p>
              <p className="text-osrs-parchment-dark/60 text-[11px]">{kind}</p>
            </div>
          </div>
          <div className={CARD_SECTION_CLASS}>
            {s.npc_name && <CardStatLine label="Source" value={s.npc_name} />}
            {worth && <CardStatLine label="Value" value={<span className="text-osrs-green">{worth}</span>} />}
            <CardStatLine label="When" value={formatRelativeTime(s.ts)} />
          </div>
          {s.item_id != null && (
            <button
              onClick={() => void openExternal(`https://www.droptracker.io/items/${s.item_id}`)}
              className="text-osrs-gold-bright mt-2.5 text-[11.5px] font-semibold hover:underline"
            >
              View item ↗
            </button>
          )}
        </div>
      }
    >
      <span className="bg-osrs-surface-2/60 border-osrs-bronze/25 hover:border-osrs-bronze/60 flex size-11 items-center justify-center rounded-lg border transition-colors">
        {s.image_url ? (
          <img
            src={s.image_url}
            alt={s.label}
            className="size-8 object-contain drop-shadow"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        ) : (
          <span aria-hidden className="text-osrs-gold/70 text-lg">
            ◆
          </span>
        )}
      </span>
    </HoverCard>
  );
}

/** Horizontal strip of the player's newest submissions, each with a hover card. */
function LatestSubmissions({ recent }: { recent: Submission[] }) {
  if (recent.length === 0) return null;
  return (
    <div>
      <SectionHeading>Your latest submissions</SectionHeading>
      <Card padding="p-3">
        <div className="flex items-center gap-2.5 overflow-x-auto pb-0.5">
          {recent.slice(0, 12).map((s, i) => (
            <SubmissionThumb key={`${s.type}-${s.id}-${i}`} s={s} />
          ))}
        </div>
      </Card>
    </div>
  );
}

export function HomeView() {
  const { guildId, group } = useActivityData();
  const { sessionToken } = useActivityAuth();
  const nav = useActivityNav();
  const my = useMyProfile();

  const [activeEvents, setActiveEvents] = useState<EventSummary[] | null>(null);
  const [feed, setFeed] = useState<ActivityFeedRow[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);

  // Active events power the Events card's live pill. No guild context (an
  // Activity Link opened from a DM) → the user's events across their groups.
  useEffect(() => {
    if (!guildId && !sessionToken) {
      setActiveEvents([]);
      return;
    }
    let cancelled = false;
    (guildId ? guildEvents(guildId, "active", null) : myEvents("active", sessionToken!))
      .then((evs) => {
        if (!cancelled) setActiveEvents(evs);
      })
      .catch(() => setActiveEvents([]));
    return () => {
      cancelled = true;
    };
  }, [guildId, sessionToken]);

  // Feed: seed from history, then prepend live frames.
  useEffect(() => {
    let cancelled = false;
    recentFeed()
      .then((events) => {
        if (cancelled) return;
        const rows = events
          .map((e, i) => toActivityFeedRow(e.type, e.data, `h-${i}`))
          .filter((r): r is ActivityFeedRow => r != null)
          .slice(0, FEED_LIMIT);
        setFeed(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const liveSeq = useRef(0);
  useEventStream(["feed"], (event) => {
    const row = toActivityFeedRow(event.type, event.data as Record<string, unknown>, `l-${liveSeq.current++}`);
    if (row) setFeed((prev) => [row, ...prev].slice(0, FEED_LIMIT));
  });

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      searchAll(q)
        .then(setResults)
        .catch(() => setResults(null));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const liveEvent = activeEvents?.[0];

  return (
    <div className="lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* Personal rail: the player panel + their clan. */}
      <div className="space-y-2.5">
        <PersonalPanel my={my} />

        {/* Clan card */}
        <Card padding="p-4">
          <div className="flex items-center gap-3">
            {group?.icon_url ? (
              <img src={group.icon_url} alt="" className="size-11 rounded-xl object-cover" />
            ) : (
              <NameTile name={group?.name ?? "DropTracker"} size="lg" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-osrs-parchment-dark/55 text-[10.5px] tracking-widest uppercase">
                {group ? "Your clan" : guildId ? "This server" : "DropTracker"}
              </p>
              <p className="text-osrs-gold truncate font-serif text-[15px] font-semibold">
                {group?.name ?? (guildId ? "Not linked to a group yet" : "Global tracker")}
              </p>
              {group?.member_count != null && (
                <p className="text-osrs-parchment-dark/55 text-[11.5px]">
                  {group.member_count.toLocaleString()} tracked members
                </p>
              )}
            </div>
            {group && (
              <button
                onClick={() => nav.push({ name: "group", id: group.id })}
                className="text-osrs-gold-bright border-osrs-bronze/40 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold"
              >
                View
              </button>
            )}
          </div>
        </Card>
      </div>

      {/* Hub content */}
      <div className="mt-4 space-y-1 lg:mt-0">
        {/* Search */}
        <div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players, groups, bosses, items…"
            className="border-osrs-bronze/40 bg-osrs-surface-1 focus:border-osrs-gold text-osrs-parchment placeholder:text-osrs-parchment-dark/40 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
          />
          {results && (
            <Card padding="p-1" className="mt-1.5">
              {results.players.slice(0, 4).map((p) => (
                <button
                  key={`p${p.id}`}
                  onClick={() => nav.push({ name: "player", id: p.id })}
                  className="hover:bg-osrs-surface-2/60 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left"
                >
                  <NameTile name={p.name} size="sm" />
                  <span className="text-osrs-parchment flex-1 truncate text-[13px]">{p.name}</span>
                  <span className="text-osrs-parchment-dark/45 text-[10px] uppercase">Player</span>
                </button>
              ))}
              {results.groups.slice(0, 3).map((g) => (
                <button
                  key={`g${g.id}`}
                  onClick={() => nav.push({ name: "group", id: g.id })}
                  className="hover:bg-osrs-surface-2/60 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left"
                >
                  <NameTile name={g.name} size="sm" />
                  <span className="text-osrs-parchment flex-1 truncate text-[13px]">{g.name}</span>
                  <span className="text-osrs-parchment-dark/45 text-[10px] uppercase">Group</span>
                </button>
              ))}
              {[...results.npcs.slice(0, 2), ...results.items.slice(0, 2)].map((e) => (
                <button
                  key={`x${e.id}-${e.name}`}
                  onClick={() =>
                    void openExternal(
                      `https://www.droptracker.io/${results.npcs.includes(e) ? "npcs" : "items"}/${e.id}`,
                    )
                  }
                  className="hover:bg-osrs-surface-2/60 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left"
                >
                  {e.icon_url ? (
                    <img src={e.icon_url} alt="" className="size-6 object-contain" />
                  ) : (
                    <NameTile name={e.name} size="sm" />
                  )}
                  <span className="text-osrs-parchment flex-1 truncate text-[13px]">{e.name}</span>
                  <span className="text-osrs-parchment-dark/45 text-[10px] uppercase">Site ↗</span>
                </button>
              ))}
              {!results.players.length && !results.groups.length && !results.npcs.length && !results.items.length && (
                <p className="text-osrs-parchment-dark/50 px-3 py-2.5 text-center text-xs">
                  No matches for “{query.trim()}”.
                </p>
              )}
            </Card>
          )}
        </div>

        {/* Section cards */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 xl:grid-cols-4">
          <NavCard
            title="Events"
            detail={liveEvent ? `${liveEvent.name} — live board & tasks` : "Bingo boards & task races"}
            live={liveEvent ? "Running now" : undefined}
            onPress={() => nav.setRoot({ name: "events" })}
            icon={
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <path d="M4 9h16M9 4v16" />
              </svg>
            }
          />
          <NavCard
            title="Leaderboards"
            detail="Top players & clans by loot"
            onPress={() => nav.setRoot({ name: "ranks", tab: "players" })}
            icon={
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M6 9V4h12v5a6 6 0 0 1-12 0Z" />
                <path d="M9 20h6M12 15v5" />
              </svg>
            }
          />
          <NavCard
            title="Personal bests"
            detail="Fastest kill times by boss"
            onPress={() => nav.setRoot({ name: "ranks", tab: "pbs" })}
            icon={
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            }
          />
          <NavCard
            title="My profile"
            detail="Your accounts & achievements"
            onPress={() => nav.setRoot({ name: "me" })}
            icon={
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
              </svg>
            }
          />
        </div>

        {/* Your latest submissions (signed-in only) */}
        {sessionToken && <LatestSubmissions recent={my.recent} />}

        {/* Live feed */}
        {feed.length > 0 && (
          <div>
            <SectionHeading>Latest activities</SectionHeading>
            <Card padding="p-0">
              {feed.map((row) => (
                <div
                  key={row.key}
                  className="border-osrs-bronze/20 flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0"
                >
                  {row.iconUrl ? (
                    <img src={row.iconUrl} alt="" className="size-7 shrink-0 object-contain" loading="lazy" />
                  ) : (
                    <NameTile name={row.playerName} size="sm" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="text-osrs-parchment block truncate text-[12.5px]">
                      {row.playerId ? (
                        <button
                          onClick={() => nav.push({ name: "player", id: row.playerId! })}
                          className="text-osrs-gold-bright font-semibold hover:underline"
                        >
                          {row.playerName}
                        </button>
                      ) : (
                        <span className="font-semibold">{row.playerName}</span>
                      )}{" "}
                      · {row.headline}
                    </span>
                    <span className="text-osrs-parchment-dark/50 block truncate text-[10.5px]">
                      {row.detail}
                    </span>
                  </span>
                  {row.value != null && (
                    <span className="text-osrs-green shrink-0 text-[12px] font-semibold tabular-nums">
                      {formatGp(row.value)}
                    </span>
                  )}
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
