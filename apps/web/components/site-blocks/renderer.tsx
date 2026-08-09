/**
 * Block renderer for tenant mini-site pages (sites-v1).
 *
 * Server component. Receives the page's stored blocks (loosely typed — the
 * backend validated structure at save time) plus the group profile fetched
 * once by the page; each block is narrowed with `SiteBlockSchema.safeParse`
 * and anything unrecognized renders nothing (forward compat with newer
 * schema_versions, and the deferred v1 types: lootboard/pb_board/recap/
 * announcements/live_ticker land in a later pass).
 *
 * `custom_html` renders the SERVER-SANITIZED `html` field only (nh3 at save
 * time, see disc/web_api/site_sanitizer.py); `source` never reaches this
 * surface. The tenant-host CSP is the backstop.
 */
import type { GroupProfile } from "@droptracker/api-types";
import { SiteBlockSchema, type SiteBlock } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { CountUp } from "@/components/count-up";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { LiveDropTicker } from "@/components/live-drop-ticker";
import { LootboardCanvas } from "@/components/lootboard-canvas";
import { Markdown } from "@/components/markdown";
import { PbBoards } from "@/components/pb-boards";
import { BossActivityList, RecordsShowcase, TopPlayersList } from "@/components/profile-stats";
import { RecapCard } from "@/components/recap-card";
import { SubmissionList } from "@/components/submission-list";
import { Card, EmptyState, StatTile } from "@/components/ui";

function StatsRow({ group, stats }: { group: GroupProfile; stats: string[] }) {
  const tiles = stats.map((key) => {
    switch (key) {
      case "members":
        return (
          <StatTile
            key={key}
            label="Members"
            value={
              <CountUp value={group.member_count} formatted={group.member_count.toLocaleString()} />
            }
          />
        );
      case "monthly_loot":
        return (
          <StatTile
            key={key}
            label="Monthly loot"
            value={
              group.monthly_loot ? (
                <CountUp
                  value={group.monthly_loot.value}
                  formatted={group.monthly_loot.value_formatted}
                />
              ) : (
                "—"
              )
            }
          />
        );
      case "rank":
        return <StatTile key={key} label="Global rank" value={`#${group.global_rank ?? "—"}`} />;
      case "top_player":
        return (
          <StatTile key={key} label="Top player" value={group.top_player?.name ?? "—"} />
        );
      default:
        return null;
    }
  });
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{tiles.filter(Boolean)}</div>
  );
}

function HeroBlock({
  block,
  group,
}: {
  block: Extract<SiteBlock, { type: "hero" }>;
  group: GroupProfile;
}) {
  return (
    <header className="flex flex-wrap items-center gap-5 py-4">
      {block.image_url ? (
        // Plain <img>: uploaded GIFs stay animated (repo-wide convention).
        <img
          src={block.image_url}
          alt=""
          className="border-osrs-bronze/40 size-20 shrink-0 rounded-2xl border object-cover"
        />
      ) : group.icon_url ? (
        <img
          src={group.icon_url}
          alt=""
          className="border-osrs-bronze/40 size-20 shrink-0 rounded-2xl border object-cover"
        />
      ) : null}
      <div>
        <h1 className="text-osrs-gold font-display text-4xl font-bold">{block.heading}</h1>
        {block.tagline && (
          <p className="text-osrs-parchment-dark/90 mt-1 max-w-2xl text-lg">{block.tagline}</p>
        )}
      </div>
    </header>
  );
}

function ButtonsBlock({ block }: { block: Extract<SiteBlock, { type: "buttons" }> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {block.items.map((item, i) => (
        <a
          key={i}
          href={item.href}
          rel="noopener noreferrer"
          className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium transition-colors"
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

const DIVIDER_SPACE = { sm: "py-2", md: "py-5", lg: "py-10" } as const;

/* --- data blocks: async server components, each owns its fetch + fallback --- */

async function LootboardBlock({ groupId, period }: { groupId: number; period: string }) {
  const board = await api.lootboard(groupId, period).catch(() => null);
  if (!board) return <EmptyState title="Lootboard unavailable" />;
  return <LootboardCanvas board={board} />;
}

async function PbBoardBlock({ groupId, bossId }: { groupId: number; bossId?: number }) {
  let npcId = bossId;
  if (npcId == null) {
    const index = await api.pbBosses(groupId).catch(() => null);
    npcId = index?.bosses[0]?.npc_id;
  }
  const board = npcId != null ? await api.pbBoard(npcId, groupId).catch(() => null) : null;
  if (!board) return <EmptyState title="No personal bests yet" />;
  return <PbBoards board={board} />;
}

async function LeaderboardBlock({ groupId, limit }: { groupId: number; limit: number }) {
  const scope = `group:${groupId}`;
  const page = await api.playerLeaderboard({ scope, period: "month", limit }).catch(() => null);
  if (!page || page.entries.length === 0) return <EmptyState title="No ranked players yet" />;
  return <LeaderboardTable entries={page.entries.slice(0, limit)} scope={scope} kind="players" />;
}

async function RecapBlock({ groupId, period }: { groupId: number; period: string }) {
  // "month"/"year" resolve to the newest frozen card via the recap index.
  const index = await api.recapIndex("group", groupId).catch(() => null);
  const match = index?.periods.find((p) => p.kind === period);
  const recap = match
    ? await api.recap("group", groupId, match.period).catch(() => null)
    : null;
  if (!recap) return <EmptyState title="No recap yet" hint="Recaps appear after the period ends." />;
  return <RecapCard recap={recap} fluid />;
}

async function AnnouncementsBlock({ groupId, limit }: { groupId: number; limit: number }) {
  const page = await api.announcements(`group:${groupId}`).catch(() => null);
  const items = page?.items.slice(0, limit) ?? [];
  if (items.length === 0) return <EmptyState title="No announcements yet" />;
  return (
    <ul className="space-y-4">
      {items.map((a) => (
        <li key={a.id} className="border-osrs-bronze/20 border-b pb-4 last:border-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-osrs-gold-bright font-semibold">{a.title}</h3>
            <span className="text-osrs-parchment-dark/60 text-xs">
              {new Date(a.published_at * 1000).toLocaleDateString()}
            </span>
          </div>
          <div className="mt-1 text-sm">
            <Markdown>{a.body_md}</Markdown>
          </div>
        </li>
      ))}
    </ul>
  );
}

async function MemberRosterBlock({ groupId, limit }: { groupId: number; limit: number }) {
  const roster = await api.siteRoster(groupId, limit).catch(() => null);
  if (!roster || roster.members.length === 0) {
    return (
      <EmptyState
        title="Roster not available"
        hint="The group can enable its public member list in the site settings."
      />
    );
  }
  return (
    <div>
      <ul className="grid gap-x-6 sm:grid-cols-2">
        {roster.members.map((m) => (
          <li
            key={m.id}
            className="border-osrs-bronze/15 flex items-baseline justify-between gap-3 border-b py-1.5"
          >
            <span className="font-medium">{m.name}</span>
            <span className="text-osrs-gold-bright text-sm">
              {m.monthly_loot.value > 0 ? `${m.monthly_loot.value_formatted} this month` : "—"}
            </span>
          </li>
        ))}
      </ul>
      {roster.total > roster.members.length && (
        <p className="text-osrs-parchment-dark/60 mt-3 text-xs">
          Showing {roster.members.length} of {roster.total} members.
        </p>
      )}
    </div>
  );
}

async function EventStandingsBlock({ groupId, eventId }: { groupId: number; eventId?: number }) {
  let id = eventId;
  let eventName: string | null = null;
  if (id == null) {
    const events = await api.events({ groupId, status: "active" }).catch(() => []);
    id = events[0]?.id;
    eventName = events[0]?.name ?? null;
  } else {
    eventName = (await api.event(id).catch(() => null))?.name ?? null;
  }
  const teams = id != null ? await api.eventTeams(id).catch(() => null) : null;
  if (!teams || teams.teams.length === 0) {
    return <EmptyState title="No event running" hint="Standings appear during events." />;
  }
  const sorted = [...teams.teams].sort((a, b) => b.score - a.score);
  return (
    <div>
      {eventName && (
        <p className="text-osrs-parchment-dark/80 mb-2 text-sm font-medium">{eventName}</p>
      )}
      <ul className="divide-osrs-bronze/20 divide-y">
        {sorted.map((t, i) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2">
            <span className="flex items-center gap-2.5">
              <span className="text-osrs-parchment-dark/60 w-6 text-right text-sm">{i + 1}.</span>
              <span
                className="size-2.5 rounded-full"
                style={{ background: t.color ?? "var(--dt-bronze)" }}
              />
              <span className="font-medium">{t.name}</span>
              <span className="text-osrs-parchment-dark/50 text-xs">
                {t.member_count} members
              </span>
            </span>
            <span className="text-osrs-gold-bright font-semibold">
              {t.score.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function NpcBoardBlock({
  groupId,
  npcId,
  period,
  limit,
}: {
  groupId: number;
  npcId: number;
  period: string;
  limit: number;
}) {
  const scope = `group:${groupId}:npc:${npcId}`;
  const page = await api.playerLeaderboard({ scope, period, limit }).catch(() => null);
  if (!page || page.entries.length === 0) {
    return <EmptyState title="No tracked kills yet" hint="Drops from this boss will rank here." />;
  }
  return <LeaderboardTable entries={page.entries.slice(0, limit)} scope={scope} kind="players" />;
}

async function WomAchievementsBlock({ groupId, limit }: { groupId: number; limit: number }) {
  const payload = await api.womAchievements(groupId, limit).catch(() => null);
  const items = payload?.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        title="No recent achievements"
        hint="Achievements come from Wise Old Man once the group is linked."
      />
    );
  }
  return (
    <ul className="divide-osrs-bronze/20 divide-y">
      {items.map((a, i) => (
        <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <div>
            <span className="text-osrs-gold-bright font-medium">{a.player_name}</span>
            <span className="text-osrs-parchment-dark/90 ml-2 text-sm">{a.name}</span>
          </div>
          <span className="text-osrs-parchment-dark/60 text-xs">
            {a.created_at ? formatRelativeTime(new Date(a.created_at).getTime() / 1000) : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function renderBlock(block: SiteBlock, group: GroupProfile) {
  switch (block.type) {
    case "hero":
      return <HeroBlock block={block} group={group} />;
    case "markdown":
      return (
        <div className="max-w-3xl">
          <Markdown>{block.body}</Markdown>
        </div>
      );
    case "stats_row":
      return <StatsRow group={group} stats={block.stats} />;
    case "top_players":
      return (
        <Card>
          <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Top players</h2>
          {(group.top_players?.length ?? 0) > 0 ? (
            <TopPlayersList players={(group.top_players ?? []).slice(0, block.limit)} />
          ) : (
            <EmptyState title="No ranked players yet" />
          )}
        </Card>
      );
    case "records":
      return (
        <Card>
          <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Clan records</h2>
          {(group.records?.length ?? 0) > 0 ? (
            <RecordsShowcase records={group.records ?? []} />
          ) : (
            <EmptyState title="No records yet" />
          )}
        </Card>
      );
    case "boss_activity":
      return (
        <Card>
          <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Most active bosses</h2>
          {(group.top_bosses?.length ?? 0) > 0 ? (
            <BossActivityList bosses={(group.top_bosses ?? []).slice(0, block.limit)} />
          ) : (
            <EmptyState title="No boss activity yet" />
          )}
        </Card>
      );
    case "recent_drops":
      return (
        <Card>
          <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Recent drops</h2>
          <SubmissionList
            submissions={group.recent_submissions.slice(0, block.limit)}
            showPlayer
          />
        </Card>
      );
    case "image":
      return (
        <figure>
          <img
            src={block.url}
            alt={block.alt ?? ""}
            className="border-osrs-bronze/30 max-h-[36rem] w-full rounded-xl border object-cover"
          />
          {block.caption && (
            <figcaption className="text-osrs-parchment-dark/70 mt-2 text-center text-sm">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    case "buttons":
      return <ButtonsBlock block={block} />;
    case "divider":
      return (
        <div className={DIVIDER_SPACE[block.size]}>
          {block.rule && <hr className="border-osrs-bronze/30" />}
        </div>
      );
    case "custom_html":
      return (
        <div
          className="site-custom-html max-w-none"
          // Server-sanitized at save time (nh3); never the raw source.
          dangerouslySetInnerHTML={{ __html: block.html }}
        />
      );
    case "lootboard":
      return (
        <Card>
          <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Lootboard</h2>
          <LootboardBlock groupId={group.id} period={block.period} />
        </Card>
      );
    case "pb_board":
      return (
        <Card>
          <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Personal bests</h2>
          <PbBoardBlock groupId={group.id} bossId={block.boss_id} />
        </Card>
      );
    case "leaderboard":
      return (
        <Card>
          <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Monthly leaderboard</h2>
          <LeaderboardBlock groupId={group.id} limit={block.limit} />
        </Card>
      );
    case "recap":
      return <RecapBlock groupId={group.id} period={block.period} />;
    case "announcements":
      return (
        <Card>
          <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Announcements</h2>
          <AnnouncementsBlock groupId={group.id} limit={block.limit} />
        </Card>
      );
    case "live_ticker":
      return <LiveDropTicker scope={`group:${group.id}`} />;
    case "wom_achievements":
      return (
        <Card>
          <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Recent achievements</h2>
          <WomAchievementsBlock groupId={group.id} limit={block.limit} />
        </Card>
      );
    case "member_roster":
      return (
        <Card>
          <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Members</h2>
          <MemberRosterBlock groupId={group.id} limit={block.limit} />
        </Card>
      );
    case "event_standings":
      return (
        <Card>
          <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Event standings</h2>
          <EventStandingsBlock groupId={group.id} eventId={block.event_id} />
        </Card>
      );
    case "npc_board":
      return (
        <Card>
          <h2 className="text-osrs-gold mb-3 flex items-center gap-2 text-lg font-semibold">
            {/* Plain <img>: NPC art off the same static tree as everything else. */}
            <img src={`/img/npcdb/${block.npc_id}.png`} alt="" className="size-6" />
            Boss leaderboard
          </h2>
          <NpcBoardBlock
            groupId={group.id}
            npcId={block.npc_id}
            period={block.period}
            limit={block.limit}
          />
        </Card>
      );
    default:
      return null;
  }
}

export function SiteBlockRenderer({
  blocks,
  group,
}: {
  blocks: Array<Record<string, unknown>>;
  group: GroupProfile;
}) {
  return (
    <div className="space-y-6">
      {blocks.map((raw, i) => {
        const parsed = SiteBlockSchema.safeParse(raw);
        if (!parsed.success) return null;
        return <div key={(raw.id as string) ?? i}>{renderBlock(parsed.data, group)}</div>;
      })}
    </div>
  );
}
