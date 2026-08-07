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
import { CountUp } from "@/components/count-up";
import { Markdown } from "@/components/markdown";
import { BossActivityList, RecordsShowcase, TopPlayersList } from "@/components/profile-stats";
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
    // Deferred v1 block types render nothing until their pass lands.
    case "lootboard":
    case "pb_board":
    case "leaderboard":
    case "recap":
    case "announcements":
    case "live_ticker":
      return null;
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
