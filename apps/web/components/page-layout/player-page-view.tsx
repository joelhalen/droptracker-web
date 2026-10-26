/**
 * A player's public profile, rendered from a layout (web137a).
 *
 * The layout is the player's own (Supporter perk), their clan's member
 * layout, or the standard profile from lib/page-layout/catalog.ts. Like the
 * group page, the header (avatar, name, account type, supporter badge) is
 * fixed and always first.
 */
import type { ReactNode } from "react";
import type { Route } from "next";
import { PageBlockSchema, type PageBlock, type PageLayout, type PageTheme } from "@droptracker/api-types";
import type { api } from "@/lib/api";
import { BLOCK_DEF } from "@/lib/page-layout/catalog";
import { entityPath } from "@/lib/slug";
import { SOON_BADGE, SOON_TITLE, STATE_SYNC_RELEASED } from "@/lib/plugin-features";
import { momDelta, percentileHint } from "@/lib/player-profile";
import { AccountTypeBadge } from "@/components/account-type-badge";
import { CountUp } from "@/components/count-up";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { PersonalBestsGrid } from "@/components/personal-bests-grid";
import { SitePlayerClanPoints } from "@/components/player-clan-points";
import { ProfileBadgeIcons } from "@/components/player-badges";
import { PlayerPvpCard, hasPvpHistory } from "@/components/player-pvp-card";
import { ProfileShowcase } from "@/components/profile-showcase";
import { BossActivityList } from "@/components/profile-stats";
import { CollectionLogBrowser } from "@/components/collection-log-browser";
import { CombatAchievementsBrowser } from "@/components/combat-achievements-browser";
import { SubmissionList } from "@/components/submission-list";
import { Badge, EntityChip, NameTile, StatTile } from "@/components/ui";
import { HighlightsBlock } from "./group-data-blocks";
import { BannerFrame, BlockSlot, LayoutFrame, LayoutGrid, LIGHT_SURFACES, PreviewPlaceholder } from "./frame";
import { LinkRow, renderSharedBlock, type LinkItem } from "./shared-blocks";

type Api = typeof api;

export type PlayerPageContext = {
  player: Awaited<ReturnType<Api["player"]>>;
  loot: Awaited<ReturnType<Api["playerLoot"]>> | null;
  collectionLog: Awaited<ReturnType<Api["playerCollectionLog"]>> | null;
  achievements: Awaited<ReturnType<Api["playerAchievements"]>> | null;
  pvp: Awaited<ReturnType<Api["playerPvp"]>> | null;
};

function PlayerHeader({ ctx, theme }: { ctx: PlayerPageContext; theme: PageTheme }) {
  const { player } = ctx;
  const centered = theme.header_style === "centered";
  const banner = theme.header_style === "banner";
  const name = (
    <h1
      className={`flex flex-wrap items-center gap-2 text-3xl font-bold ${centered ? "justify-center" : ""} ${
        player.is_supporter
          ? "from-osrs-gold via-osrs-gold-bright to-osrs-gold bg-gradient-to-r bg-clip-text text-transparent"
          : "text-osrs-gold"
      } ${banner ? "drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" : ""}`}
    >
      {player.name}
      <AccountTypeBadge type={player.account_type} />
      {player.is_supporter && (
        <Badge variant="gold" title="This player supports DropTracker">
          ★ Supporter
        </Badge>
      )}
    </h1>
  );
  const subtitle = theme.show_description ? (
    <p className={`text-sm ${banner ? "text-white/85" : "text-osrs-parchment-dark/80"}`}>Old School RuneScape player</p>
  ) : null;

  if (banner) {
    return (
      <BannerFrame theme={theme}>
        <div className="flex min-w-0 items-end gap-4">
          <NameTile name={player.name} size="lg" playerId={player.id} />
          <div className="min-w-0">
            {name}
            {subtitle}
          </div>
        </div>
      </BannerFrame>
    );
  }
  return (
    <header className={`rise-in flex items-center gap-4 ${centered ? "flex-col text-center" : ""}`}>
      <NameTile name={player.name} size="lg" playerId={player.id} />
      <div className="min-w-0">
        {name}
        {subtitle}
      </div>
    </header>
  );
}

function playerLinks(ctx: PlayerPageContext, keys: readonly string[]): LinkItem[] {
  const { player, collectionLog, achievements } = ctx;
  const soon = (synced?: boolean) =>
    !STATE_SYNC_RELEASED && !synced ? (
      <Badge variant="neutral" size="sm" title={SOON_TITLE}>
        {SOON_BADGE}
      </Badge>
    ) : undefined;
  const all: Record<string, LinkItem> = {
    collection_log: {
      key: "collection_log",
      label: "Collection log",
      href: `/players/${player.id}/collection-log`,
      badge: soon(collectionLog?.has_synced),
    },
    achievements: {
      key: "achievements",
      label: "Achievements",
      href: `/players/${player.id}/achievements`,
      badge: soon(achievements?.has_synced),
    },
    // The recap is generated on first view, so this link is the only way
    // most players will ever discover they have one.
    recap: { key: "recap", label: "Monthly recap", href: `/players/${player.id}/recap` },
  };
  return keys.map((k) => all[k]).filter((x): x is LinkItem => x != null);
}

function PlayerStatTiles({
  ctx,
  stats,
  stacked,
  columns = "auto",
  tileStyle = "auto",
}: {
  ctx: PlayerPageContext;
  stats: readonly string[];
  stacked?: boolean;
  columns?: string;
  tileStyle?: string;
}) {
  const { collectionLog: clog, achievements: ach, pvp } = ctx;
  const { player } = ctx;
  const pctHint = percentileHint(player.global_rank, player.ranked_players);
  const delta = momDelta(player.total_loot?.value, player.previous_month_loot?.value);
  const tiles = stats.map((key) => {
    switch (key) {
      case "monthly_loot":
        return (
          <StatTile
            key={key}
            label="Monthly loot"
            value={
              player.total_loot ? (
                <CountUp value={player.total_loot.value} formatted={player.total_loot.value_formatted} />
              ) : (
                "—"
              )
            }
            hint={delta?.text}
          />
        );
      case "rank":
        return (
          <StatTile
            key={key}
            label="Global rank"
            value={player.global_rank != null ? `#${player.global_rank}` : "—"}
            hint={pctHint}
          />
        );
      case "clan_points":
        // Renders nothing for players outside a clan that runs points.
        return <SitePlayerClanPoints key={key} playerId={player.id} />;
      case "last_month_loot":
        return <StatTile key={key} label="Last month" value={player.previous_month_loot?.value_formatted ?? "—"} />;
      case "clog_slots": {
        // The game's own slot count when the log has been synced, else what
        // we've recorded (see the obtained/obtained_unique note in memory).
        const have = clog?.slots ?? clog?.obtained_unique;
        const of = clog?.slots_total ?? clog?.total;
        return (
          <StatTile
            key={key}
            label="Collection log"
            value={have != null && clog?.has_synced ? have.toLocaleString() : "—"}
            hint={have != null && of && clog?.has_synced ? `of ${of.toLocaleString()} slots` : undefined}
          />
        );
      }
      case "ca_tasks": {
        const ca = ach?.combat_achievements;
        return (
          <StatTile
            key={key}
            label="Combat achievements"
            value={ca?.tasks_completed != null ? ca.tasks_completed.toLocaleString() : "—"}
            hint={ca?.total ? `of ${ca.total.toLocaleString()} tasks` : undefined}
          />
        );
      }
      case "quests": {
        const q = ach?.quests;
        const total = q ? q.finished + q.in_progress + q.not_started : 0;
        return (
          <StatTile
            key={key}
            label="Quests"
            value={q && ach?.has_synced ? q.finished.toLocaleString() : "—"}
            hint={q && total ? `of ${total} done` : undefined}
          />
        );
      }
      case "combat_level":
        return <StatTile key={key} label="Combat level" value={ach?.combat_level != null ? String(ach.combat_level) : "—"} />;
      case "pbs_count":
        return <StatTile key={key} label="Personal bests" value={String(player.personal_bests?.length ?? 0)} />;
      case "badges_count":
        return <StatTile key={key} label="Badges" value={String(player.badges?.length ?? 0)} />;
      case "pvp_kills":
        return <StatTile key={key} label="PvP kills this month" value={pvp ? String(pvp.stats.kills ?? 0) : "—"} />;
      case "top_npc":
        return (
          <StatTile
            key={key}
            label="Top NPC"
            // A boss name is prose, not a figure.
            value={<span className="text-lg leading-snug font-semibold">{player.top_npc ?? "—"}</span>}
          />
        );
      default:
        return null;
    }
  });
  if (stacked) return <div data-pl-stats={tileStyle} className="space-y-2">{tiles}</div>;
  const n = tiles.filter(Boolean).length;
  const cols =
    columns === "2" || (columns === "auto" && n <= 2)
      ? "grid-cols-2"
      : columns === "3" || (columns === "auto" && n === 3)
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2 sm:grid-cols-4";
  return <div data-pl-stats={tileStyle} className={`grid gap-3 ${cols}`}>{tiles}</div>;
}

function ProgressList({
  rows,
  headline,
}: {
  rows: { name: string; done: number; total: number }[];
  headline?: { done: number; total: number };
}) {
  const pct = (d: number, t: number) => (t > 0 ? Math.min(100, (d / t) * 100) : 0);
  return (
    <div className="space-y-3">
      {headline && (
        <div className="flex items-baseline justify-between">
          <span className="text-osrs-gold-bright text-2xl font-bold">{Math.round(pct(headline.done, headline.total))}%</span>
          <span className="text-osrs-parchment-dark/70 text-sm">
            {headline.done.toLocaleString()} of {headline.total.toLocaleString()}
          </span>
        </div>
      )}
      <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {rows
          .filter((r) => r.total > 0)
          .map((r) => (
            <li key={r.name}>
              <div className="mb-1 flex justify-between text-xs">
                <span>{r.name}</span>
                <span className="text-osrs-parchment-dark/70 tabular-nums">
                  {r.done}/{r.total}
                </span>
              </div>
              <div className="bg-osrs-surface-3 h-2 overflow-hidden rounded-full">
                <div className="bg-osrs-gold h-full rounded-full" style={{ width: `${pct(r.done, r.total)}%` }} />
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}

function renderPlayerBlock(block: PageBlock, ctx: PlayerPageContext, light: boolean): ReactNode | null {
  const shared = renderSharedBlock(block, { light });
  if (shared !== undefined) return shared;
  const { player } = ctx;
  switch (block.type) {
    case "player_links":
      return <LinkRow items={playerLinks(ctx, block.items)} style={block.style} align={block.align} />;
    case "player_showcase":
      // Character beside the account tabs: collection log, combat
      // achievements and diaries in one place.
      return (
        <ProfileShowcase
          playerId={player.id}
          modelFingerprint={player.model_fingerprint}
          modelHasPet={player.model_has_pet}
          collectionLog={ctx.collectionLog}
          achievements={ctx.achievements}
          loot={ctx.loot}
          submissions={player.recent_submissions}
          badges={player.badges && player.badges.length > 0 ? <ProfileBadgeIcons badges={player.badges} /> : null}
          stats={<PlayerStatTiles ctx={ctx} stats={["monthly_loot", "rank", "clan_points", "top_npc"]} stacked />}
        />
      );
    case "player_stats":
      return block.stats.length > 0 ? <PlayerStatTiles ctx={ctx} stats={block.stats} columns={block.columns} tileStyle={block.tile_style} /> : null;
    case "player_clog": {
      const clog = ctx.collectionLog;
      if (!clog?.has_synced || clog.tabs.length === 0) return null;
      if (block.view === "browser") return <CollectionLogBrowser tabs={clog.tabs} details={clog.details} />;
      return <ProgressList rows={clog.tabs.map((t) => ({ name: t.name, done: t.obtained, total: t.total }))} />;
    }
    case "player_ca": {
      const ca = ctx.achievements?.combat_achievements;
      if (!ctx.achievements?.has_synced || !ca) return null;
      if (block.view === "browser") return <CombatAchievementsBrowser combat={ca} />;
      return (
        <ProgressList
          rows={(ca.tiers ?? []).map((t) => ({ name: t.tier, done: t.completed, total: t.total }))}
          headline={ca.tasks_completed != null && ca.total ? { done: ca.tasks_completed, total: ca.total } : undefined}
        />
      );
    }
    case "player_quests": {
      const a = ctx.achievements;
      if (!a?.has_synced) return null;
      const q = a.quests;
      const totals = [0, 1, 2, 3].map((tier) =>
        a.diaries.reduce((sum, area) => sum + (area.tiers.find((t) => t.tier === tier)?.completed ?? 0), 0),
      );
      return (
        <div className="space-y-4">
          {q && (
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Finished" value={String(q.finished)} />
              <StatTile label="In progress" value={String(q.in_progress)} />
              <StatTile label="Not started" value={String(q.not_started)} />
            </div>
          )}
          {a.diaries.length > 0 && (
            <div>
              <div className="text-osrs-parchment-dark/60 mb-1.5 text-xs tracking-wide uppercase">Diary tasks done</div>
              <div className="grid grid-cols-4 gap-3">
                {["Easy", "Medium", "Hard", "Elite"].map((name, i) => (
                  <StatTile key={name} label={name} value={String(totals[i] ?? 0)} />
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    case "player_highlights":
      return <HighlightsBlock scope="player" id={player.id} types={block.types} limit={block.limit} />;
    case "personal_bests":
      return (player.personal_bests?.length ?? 0) > 0 ? (
        <div>
          <div className="mb-2 flex justify-end">
            <Badge variant="sky">{player.personal_bests!.length} bosses</Badge>
          </div>
          <PersonalBestsGrid pbs={player.personal_bests!} initial={block.limit} />
        </div>
      ) : null;
    case "top_bosses":
      return (player.top_bosses?.length ?? 0) > 0 ? (
        <BossActivityList bosses={player.top_bosses!.slice(0, block.limit)} />
      ) : null;
    case "player_groups":
      return player.groups.length > 0 ? (
        <ul className="space-y-2.5 text-sm">
          {player.groups.map((g) => (
            <li key={g.id}>
              <EntityHoverCard kind="group" id={g.id} name={g.name} className="flex min-w-0">
                <EntityChip
                  href={entityPath("groups", g.id, g.name) as Route}
                  name={g.name}
                  size="sm"
                  flair={g.flair?.style}
                  flairTitle={g.flair?.tier_name}
                />
              </EntityHoverCard>
            </li>
          ))}
        </ul>
      ) : null;
    case "player_pvp":
      return hasPvpHistory(ctx.pvp) ? <PlayerPvpCard pvp={ctx.pvp!} /> : null;
    case "player_recent_drops":
      return player.recent_submissions.length > 0 ? (
        <SubmissionList submissions={player.recent_submissions.slice(0, block.limit)} />
      ) : null;
    case "player_badges":
      return player.badges && player.badges.length > 0 ? <ProfileBadgeIcons badges={player.badges} /> : null;
    default:
      return null;
  }
}

const EMPTY_HINT: Partial<Record<string, string>> = {
  personal_bests: "Shows once the player sets a personal best.",
  top_bosses: "Shows once loot comes in this month.",
  player_groups: "Shows when the player is in a clan.",
  player_pvp: "Shows after a first PvP kill or death.",
  player_recent_drops: "Shows once the player submits loot.",
  player_badges: "Shows once the player earns a badge.",
  player_clog: "Shows once the collection log syncs from the plugin.",
  player_ca: "Shows once combat achievements sync from the plugin.",
  player_quests: "Shows once quests and diaries sync from the plugin.",
  player_highlights: "Shows once the player gets the chosen kinds of loot.",
  markdown: "Write something in the settings.",
  image: "Add an image address in the settings.",
  buttons: "Add a button in the settings.",
};

export function PlayerPageView({
  layout,
  ctx,
  preview = false,
}: {
  layout: PageLayout;
  ctx: PlayerPageContext;
  preview?: boolean;
}) {
  const blocks: ReactNode[] = [];
  for (const raw of layout.blocks) {
    const parsed = PageBlockSchema.safeParse(raw);
    if (!parsed.success) continue;
    const block = parsed.data;
    const def = BLOCK_DEF[block.type];
    if (!def || def.scope === "group") continue;
    const light = LIGHT_SURFACES.has(block.surface);
    let content = renderPlayerBlock(block, ctx, light);
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
      <PlayerHeader ctx={ctx} theme={layout.theme} />
      <LayoutGrid>{blocks}</LayoutGrid>
    </LayoutFrame>
  );
}
