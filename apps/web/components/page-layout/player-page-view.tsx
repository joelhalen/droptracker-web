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
import { SubmissionList } from "@/components/submission-list";
import { Badge, EntityChip, NameTile, StatTile } from "@/components/ui";
import { BlockSlot, LayoutFrame, LayoutGrid, LIGHT_SURFACES, PreviewPlaceholder } from "./frame";
import { LinkRow, renderSharedBlock, type LinkItem } from "./shared-blocks";

type Api = typeof api;

export type PlayerPageContext = {
  player: Awaited<ReturnType<Api["player"]>>;
  loot: Awaited<ReturnType<Api["playerLoot"]>> | null;
  collectionLog: Awaited<ReturnType<Api["playerCollectionLog"]>> | null;
  achievements: Awaited<ReturnType<Api["playerAchievements"]>> | null;
  pvp: Awaited<ReturnType<Api["playerPvp"]>> | null;
};

const BANNER_HEIGHT = { sm: "h-28 sm:h-32", md: "h-36 sm:h-48", lg: "h-48 sm:h-72" } as const;

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
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-4 sm:p-6">
            <NameTile name={player.name} size="lg" playerId={player.id} />
            <div className="min-w-0">
              {name}
              {subtitle}
            </div>
          </div>
        </div>
      </header>
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

function PlayerStatTiles({ ctx, stats, stacked }: { ctx: PlayerPageContext; stats: readonly string[]; stacked?: boolean }) {
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
  return stacked ? (
    <div className="space-y-2">{tiles}</div>
  ) : (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{tiles}</div>
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
      return block.stats.length > 0 ? <PlayerStatTiles ctx={ctx} stats={block.stats} /> : null;
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
