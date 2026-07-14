"use client";

/**
 * Activity home hub: clan hero, search, section cards mirroring the site IA,
 * and a live slice of the global feed (SSE-topped, history-seeded).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { EventSummary, SearchResults } from "@droptracker/api-types";
import { Card, NameTile } from "@/components/ui";
import { useEventStream } from "@/lib/use-event-stream";
import { formatGp } from "@/lib/format";
import { guildEvents, recentFeed, searchAll } from "@/lib/activity/api";
import { toActivityFeedRow, type ActivityFeedRow } from "@/lib/activity/feed";
import { useActivityAuth } from "@/lib/activity/auth-context";
import { useActivityData } from "@/lib/activity/data-context";
import { useActivityNav } from "@/lib/activity/nav";
import { openExternal } from "@/lib/activity/discord-sdk";
import { SectionHeading } from "@/components/activity/bits";

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

export function HomeView() {
  const { guildId, group } = useActivityData();
  const { user } = useActivityAuth();
  const nav = useActivityNav();

  const [activeEvents, setActiveEvents] = useState<EventSummary[] | null>(null);
  const [feed, setFeed] = useState<ActivityFeedRow[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);

  // Active events power the Events card's live pill.
  useEffect(() => {
    if (!guildId) {
      setActiveEvents([]);
      return;
    }
    let cancelled = false;
    guildEvents(guildId, "active", null)
      .then((evs) => {
        if (!cancelled) setActiveEvents(evs);
      })
      .catch(() => setActiveEvents([]));
    return () => {
      cancelled = true;
    };
  }, [guildId]);

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
  const greeting = useMemo(() => {
    const name = user?.global_name ?? user?.username;
    return name ? `Welcome back, ${name}` : "Welcome";
  }, [user]);

  return (
    <div className="space-y-1">
      {/* Clan hero */}
      <Card padding="p-4" className="bg-gradient-to-br from-osrs-surface-2 to-osrs-surface-1">
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
            <p className="text-osrs-gold truncate font-serif text-lg font-semibold">
              {group?.name ?? (guildId ? "Not linked to a group yet" : greeting)}
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

      {/* Search */}
      <div className="pt-2">
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
      <div className="grid grid-cols-2 gap-2.5 pt-2">
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

      {/* Live feed */}
      {feed.length > 0 && (
        <div>
          <SectionHeading>Live across DropTracker</SectionHeading>
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
  );
}
