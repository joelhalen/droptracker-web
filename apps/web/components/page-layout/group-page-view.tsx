/**
 * A group's public page, rendered from a layout (web137a).
 *
 * Every group page goes through here: a published custom layout, or the
 * standard one from lib/page-layout/catalog.ts. The header (icon, name, tier
 * badge, description, admin shortcut) is fixed and always first, so every
 * clan page keeps the site's identity in the same place. Everything below it
 * is the layout's blocks.
 *
 * A block with nothing to show is left out for visitors (a quiet month should
 * not fill the page with empty boxes). In the builder preview it renders a
 * dashed placeholder instead, so the editor can still see and select it.
 */
import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import {
  PageBlockSchema,
  type GroupProfile,
  type PageBlock,
  type PageLayout,
  type PageTheme,
} from "@droptracker/api-types";
import type { api } from "@/lib/api";
import { BLOCK_DEF } from "@/lib/page-layout/catalog";
import { entityPath } from "@/lib/slug";
import { CountUp } from "@/components/count-up";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { GroupBankPanel } from "@/components/group-bank-panel";
import { GroupSupportCard } from "@/components/group-support-card";
import { LiveDropTicker } from "@/components/live-drop-ticker";
import { BossActivityList, RecordsShowcase, TopPlayersList } from "@/components/profile-stats";
import { SubmissionList } from "@/components/submission-list";
import { EntityChip, NameTile, StatTile, TierBadge } from "@/components/ui";
import {
  AnnouncementsBlock,
  EventStandingsBlock,
  LeaderboardBlock,
  LootboardBlock,
  MemberRosterBlock,
  NpcBoardBlock,
  PbBoardBlock,
  RecapBlock,
  WomAchievementsBlock,
} from "@/components/site-blocks/renderer";
import { BlockSlot, LayoutFrame, LayoutGrid, LIGHT_SURFACES, PreviewPlaceholder } from "./frame";
import { LinkRow, renderSharedBlock, type LinkItem } from "./shared-blocks";

type Api = typeof api;

export type GroupPageContext = {
  group: GroupProfile;
  /** Pretty base for the group's own sub-pages (slug or id). */
  base: string;
  subSummary: Awaited<ReturnType<Api["groupSubscriptionSummary"]>> | null;
  bank: Awaited<ReturnType<Api["groupBank"]>> | null;
  latestRecap: string | null;
  signedIn: boolean;
  manage: { href: string; label: string } | null;
  hasActiveEvents?: boolean;
};

const BANNER_HEIGHT = { sm: "h-28 sm:h-32", md: "h-36 sm:h-48", lg: "h-48 sm:h-72" } as const;

function GroupHeader({ ctx, theme }: { ctx: GroupPageContext; theme: PageTheme }) {
  const { group, manage } = ctx;
  const centered = theme.header_style === "centered";
  const banner = theme.header_style === "banner";
  const description = theme.show_description ? group.description : null;

  const icon = group.icon_url ? (
    // Plain <img>: admin-uploaded GIF icons stay animated.
    <img
      src={group.icon_url}
      alt=""
      width={56}
      height={56}
      className={`border-osrs-bronze/40 shrink-0 rounded-xl border object-cover ${banner ? "size-20 shadow-lg" : "size-14"}`}
    />
  ) : (
    <NameTile name={group.name} size="lg" flair={group.flair?.style} />
  );

  const manageLink = manage && (
    <Link
      href={manage.href as Route}
      className="border-osrs-gold/60 text-osrs-gold-bright hover:bg-osrs-gold/15 inline-flex shrink-0 items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium"
    >
      <span aria-hidden>⚙</span> {manage.label}
    </Link>
  );

  const title = (
    <div className={`flex flex-wrap items-center gap-2 ${centered ? "justify-center" : ""}`}>
      <h1 className={`text-osrs-gold text-3xl font-bold ${banner ? "drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" : ""}`}>
        {group.name}
      </h1>
      {group.flair && <TierBadge tierKey={group.flair.tier_key} name={group.flair.tier_name} />}
    </div>
  );

  if (banner) {
    return (
      <header className="rise-in">
        <div
          className={`border-osrs-bronze/40 relative overflow-hidden rounded-2xl border ${BANNER_HEIGHT[theme.banner_height]}`}
          style={
            theme.banner_url
              ? { backgroundImage: `url(${JSON.stringify(theme.banner_url)})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: "linear-gradient(135deg, var(--dt-surface-3), var(--dt-brown-dark))" }
          }
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-4 sm:p-6">
            <div className="flex min-w-0 items-end gap-4">
              {icon}
              <div className="min-w-0">
                {title}
                {description && <p className="max-w-2xl text-sm text-white/85 sm:text-base">{description}</p>}
              </div>
            </div>
            {manageLink}
          </div>
        </div>
      </header>
    );
  }

  if (centered) {
    return (
      <header className="rise-in flex flex-col items-center gap-3 text-center">
        {icon}
        {title}
        {description && <p className="text-osrs-parchment-dark/80 max-w-2xl">{description}</p>}
        {manageLink}
      </header>
    );
  }

  return (
    <header className="rise-in flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        {icon}
        <div className="min-w-0">
          {title}
          {description && <p className="text-osrs-parchment-dark/80 max-w-2xl">{description}</p>}
        </div>
      </div>
      {manageLink}
    </header>
  );
}

function groupLinks(ctx: GroupPageContext, keys: readonly string[]): LinkItem[] {
  const { group, base } = ctx;
  const all: Record<string, LinkItem | null> = {
    lootboard: { key: "lootboard", label: "Lootboard", href: `${base}/lootboard` },
    clan_log: { key: "clan_log", label: "Clan Log", href: `${base}/log` },
    personal_bests: { key: "personal_bests", label: "Personal bests", href: `${base}/personal-bests` },
    pvp: { key: "pvp", label: "PvP", href: `${base}/pvp` },
    points:
      group.points_enabled !== false
        ? { key: "points", label: "Points", href: `${base}/points/leaderboard` }
        : null,
    recaps: ctx.latestRecap
      ? { key: "recaps", label: "Recaps", href: `/groups/${group.id}/recap/${ctx.latestRecap}` }
      : null,
    events: { key: "events", label: "Events", href: `/events?group=${group.id}` },
    discord: group.discord_url
      ? { key: "discord", label: "Join Discord", href: group.discord_url, external: true, accent: true }
      : null,
  };
  return keys.map((k) => all[k]).filter((x): x is LinkItem => x != null);
}

function StatsTiles({ group, stats }: { group: GroupProfile; stats: readonly string[] }) {
  const tiles = stats.map((key) => {
    switch (key) {
      case "members":
        return (
          <StatTile
            key={key}
            label="Members"
            value={<CountUp value={group.member_count} formatted={group.member_count.toLocaleString()} />}
          />
        );
      case "rank":
        return <StatTile key={key} label="Global rank" value={`#${group.global_rank ?? "—"}`} />;
      case "monthly_loot":
        return (
          <StatTile
            key={key}
            label="Monthly loot"
            value={
              group.monthly_loot ? (
                <CountUp value={group.monthly_loot.value} formatted={group.monthly_loot.value_formatted} />
              ) : (
                "—"
              )
            }
          />
        );
      case "top_player":
        return (
          <div key={key} className="bg-osrs-surface-2/70 rounded-lg px-4 py-3">
            <div className="text-osrs-parchment-dark/60 text-xs tracking-wide uppercase">Top player</div>
            {group.top_player ? (
              <EntityHoverCard kind="player" id={group.top_player.id} name={group.top_player.name} className="flex min-w-0">
                <EntityChip
                  href={entityPath("players", group.top_player.id, group.top_player.name)}
                  name={group.top_player.name}
                  size="sm"
                  className="mt-1.5"
                  subtitle={group.top_player.total_loot?.value_formatted}
                  playerId={group.top_player.id}
                />
              </EntityHoverCard>
            ) : (
              <div className="text-osrs-gold-bright mt-0.5 text-2xl font-bold">—</div>
            )}
          </div>
        );
      default:
        return null;
    }
  });
  const shown = tiles.filter(Boolean);
  if (shown.length === 0) return null;
  const cols = shown.length >= 4 ? "sm:grid-cols-4" : shown.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return <div className={`stagger-children grid grid-cols-2 gap-3 ${cols}`}>{shown}</div>;
}

/** Content for one block, or null when it has nothing to show right now. */
function renderGroupBlock(block: PageBlock, ctx: GroupPageContext, light: boolean): ReactNode | null {
  const shared = renderSharedBlock(block, { light });
  if (shared !== undefined) return shared;
  const { group } = ctx;
  switch (block.type) {
    case "group_links":
      return <LinkRow items={groupLinks(ctx, block.items)} style={block.style} align={block.align} />;
    case "support_card":
      return ctx.subSummary ? (
        <GroupSupportCard groupId={group.id} summary={ctx.subSummary} signedIn={ctx.signedIn} />
      ) : null;
    case "stats_row":
      return <StatsTiles group={group} stats={block.stats} />;
    case "bank":
      return ctx.bank?.visible && ctx.bank.has_activity ? (
        <GroupBankPanel bank={ctx.bank} manageHref={ctx.bank.can_manage ? `/groups/${group.id}/bank` : null} />
      ) : null;
    case "records":
      return (group.records?.length ?? 0) > 0 ? (
        <RecordsShowcase records={group.records!.slice(0, block.limit)} />
      ) : null;
    case "top_players":
      return (group.top_players?.length ?? 0) > 0 ? (
        <TopPlayersList players={group.top_players!.slice(0, block.limit)} />
      ) : null;
    case "boss_activity":
      return (group.top_bosses?.length ?? 0) > 0 ? (
        <BossActivityList bosses={group.top_bosses!.slice(0, block.limit)} />
      ) : null;
    case "recent_drops":
      return group.recent_submissions.length > 0 ? (
        <SubmissionList submissions={group.recent_submissions.slice(0, block.limit)} showPlayer />
      ) : null;
    case "lootboard":
      return <LootboardBlock groupId={group.id} period={block.period} />;
    case "pb_board":
      return (
        <PbBoardBlock
          groupId={group.id}
          selections={block.bosses.map((b) => ({ npc_id: b.npc_id, team_sizes: b.team_sizes }))}
          rows={block.rows}
          maxSizes={3}
        />
      );
    case "leaderboard":
      return <LeaderboardBlock groupId={group.id} limit={block.limit} />;
    case "npc_board":
      return block.npc_id ? (
        <NpcBoardBlock groupId={group.id} npcId={block.npc_id} period={block.period} limit={block.limit} />
      ) : null;
    case "recap":
      return ctx.latestRecap ? <RecapBlock groupId={group.id} period={block.period} /> : null;
    case "announcements":
      return <AnnouncementsBlock groupId={group.id} limit={block.limit} />;
    case "event_standings":
      return <EventStandingsBlock groupId={group.id} eventId={block.event_id ?? undefined} />;
    case "wom_achievements":
      return <WomAchievementsBlock groupId={group.id} limit={block.limit} />;
    case "member_roster":
      return (
        <MemberRosterBlock
          groupId={group.id}
          limit={block.limit}
          sort={block.sort}
          layout={block.layout}
          showRank={block.show_rank}
          sortable={block.sortable}
        />
      );
    case "live_ticker":
      return <LiveDropTicker scope={`group:${group.id}`} />;
    default:
      return null;
  }
}

const EMPTY_HINT: Partial<Record<string, string>> = {
  support_card: "Shows when the group can take contributions.",
  bank: "Shows once the clan bank has entries (and isn't private).",
  records: "Shows once members set personal bests.",
  top_players: "Shows once loot comes in this month.",
  boss_activity: "Shows once loot comes in this month.",
  recent_drops: "Shows once members submit loot.",
  npc_board: "Pick a boss in the settings.",
  recap: "Shows after the first monthly recap.",
  markdown: "Write something in the settings.",
  image: "Add an image address in the settings.",
  buttons: "Add a button in the settings.",
  group_links: "None of the chosen links apply to this group yet.",
  stats_row: "Pick at least one stat.",
};

export function GroupPageView({
  layout,
  ctx,
  preview = false,
}: {
  layout: PageLayout;
  ctx: GroupPageContext;
  preview?: boolean;
}) {
  const blocks: ReactNode[] = [];
  for (const raw of layout.blocks) {
    const parsed = PageBlockSchema.safeParse(raw);
    if (!parsed.success) continue;
    const block = parsed.data;
    const def = BLOCK_DEF[block.type];
    if (!def || def.scope === "player") continue;
    const light = LIGHT_SURFACES.has(block.surface);
    let content = renderGroupBlock(block, ctx, light);
    if (content == null) {
      if (!preview) continue;
      content = <PreviewPlaceholder label={def.label} hint={EMPTY_HINT[block.type] ?? "Nothing to show yet."} />;
    }
    blocks.push(
      <BlockSlot
        key={block.id}
        id={block.id}
        label={def.label}
        width={block.width}
        surface={block.surface}
        title={block.title}
        hideOn={block.hide_on}
        preview={preview}
      >
        {content}
      </BlockSlot>,
    );
  }
  return (
    <LayoutFrame theme={layout.theme} preview={preview}>
      <GroupHeader ctx={ctx} theme={layout.theme} />
      <LayoutGrid>{blocks}</LayoutGrid>
    </LayoutFrame>
  );
}
