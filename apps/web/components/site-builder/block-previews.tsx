"use client";

/**
 * Client-side block previews for the drag-and-drop site editor (sites-v1).
 *
 * The editor canvas doubles as the live preview: profile-backed blocks render
 * with the group's REAL data through the same components the tenant page
 * uses, so what admins arrange is what visitors get. Blocks whose data lives
 * behind server fetches (lootboard canvas, leaderboards, WOM, roster, events,
 * recap, ticker) render a representative placeholder card with their config
 * summary — the "Open draft preview" button shows those fully rendered on the
 * real tenant host.
 *
 * custom_html previews ONLY the server-sanitized `html` from the last save —
 * never the raw source (the sanitize-at-save contract holds in the editor
 * too).
 */
import type { GroupProfile } from "@droptracker/api-types";
import { SiteBlockSchema, type SiteBlock } from "@droptracker/api-types";
import { CountUp } from "@/components/count-up";
import { Markdown } from "@/components/markdown";
import { BossActivityList, RecordsShowcase, TopPlayersList } from "@/components/profile-stats";
import { SubmissionList } from "@/components/submission-list";
import { EmptyState, StatTile } from "@/components/ui";
import { BLOCK_META, type Block } from "@/components/site-builder/block-forms";

function PlaceholderCard({
  type,
  detail,
}: {
  type: string;
  detail?: string;
}) {
  const meta = BLOCK_META[type];
  return (
    <div className="border-osrs-bronze/40 bg-osrs-surface-1/60 rounded-xl border border-dashed p-5 text-center">
      <div className="text-2xl">{meta?.icon ?? "◇"}</div>
      <div className="text-osrs-gold mt-1 font-semibold">{meta?.label ?? type}</div>
      <div className="text-osrs-parchment-dark/60 mt-0.5 text-xs">
        {detail ?? "Renders with live data on your site — check the draft preview."}
      </div>
    </div>
  );
}

function StatsRowPreview({ group, stats }: { group: GroupProfile; stats: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.includes("members") && (
        <StatTile
          label="Members"
          value={<CountUp value={group.member_count} formatted={group.member_count.toLocaleString()} />}
        />
      )}
      {stats.includes("monthly_loot") && (
        <StatTile
          label="Monthly loot"
          value={group.monthly_loot ? group.monthly_loot.value_formatted : "—"}
        />
      )}
      {stats.includes("rank") && (
        <StatTile label="Global rank" value={`#${group.global_rank ?? "—"}`} />
      )}
      {stats.includes("top_player") && (
        <StatTile label="Top player" value={group.top_player?.name ?? "—"} />
      )}
    </div>
  );
}

function CardShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-osrs-bronze/30 bg-osrs-surface-1 shadow-osrs-card rounded-xl border p-5">
      <h2 className="text-osrs-gold mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function renderPreview(block: SiteBlock, group: GroupProfile) {
  switch (block.type) {
    case "hero":
      return (
        <header className="flex flex-wrap items-center gap-5 py-4">
          {(block.image_url || group.icon_url) && (
            <img
              src={block.image_url || group.icon_url || ""}
              alt=""
              className="border-osrs-bronze/40 size-20 shrink-0 rounded-2xl border object-cover"
            />
          )}
          <div>
            <h1 className="text-osrs-gold font-display text-4xl font-bold">{block.heading}</h1>
            {block.tagline && (
              <p className="text-osrs-parchment-dark/90 mt-1 max-w-2xl text-lg">{block.tagline}</p>
            )}
          </div>
        </header>
      );
    case "markdown":
      return (
        <div className="max-w-3xl">
          <Markdown>{block.body}</Markdown>
        </div>
      );
    case "stats_row":
      return <StatsRowPreview group={group} stats={block.stats} />;
    case "top_players":
      return (
        <CardShell title="Top players">
          {(group.top_players?.length ?? 0) > 0 ? (
            <TopPlayersList players={(group.top_players ?? []).slice(0, block.limit)} />
          ) : (
            <EmptyState title="No ranked players yet" />
          )}
        </CardShell>
      );
    case "records":
      return (
        <CardShell title="Clan records">
          {(group.records?.length ?? 0) > 0 ? (
            <RecordsShowcase records={group.records ?? []} />
          ) : (
            <EmptyState title="No records yet" />
          )}
        </CardShell>
      );
    case "boss_activity":
      return (
        <CardShell title="Most active bosses">
          {(group.top_bosses?.length ?? 0) > 0 ? (
            <BossActivityList bosses={(group.top_bosses ?? []).slice(0, block.limit)} />
          ) : (
            <EmptyState title="No boss activity yet" />
          )}
        </CardShell>
      );
    case "recent_drops":
      return (
        <CardShell title="Recent drops">
          <SubmissionList submissions={group.recent_submissions.slice(0, block.limit)} showPlayer />
        </CardShell>
      );
    case "image":
      return block.url ? (
        <figure>
          <img
            src={block.url}
            alt={block.alt ?? ""}
            className="border-osrs-bronze/30 max-h-[24rem] w-full rounded-xl border object-cover"
          />
          {block.caption && (
            <figcaption className="text-osrs-parchment-dark/70 mt-2 text-center text-sm">
              {block.caption}
            </figcaption>
          )}
        </figure>
      ) : (
        <PlaceholderCard type="image" detail="Set an image URL in the settings panel." />
      );
    case "buttons":
      return (
        <div className="flex flex-wrap gap-2">
          {block.items.map((item, i) => (
            <span
              key={i}
              className="bg-osrs-bronze rounded px-4 py-2 text-sm font-medium"
            >
              {item.label || "Button"}
            </span>
          ))}
        </div>
      );
    case "divider": {
      const space = { sm: "py-2", md: "py-5", lg: "py-10" }[block.size];
      return <div className={space}>{block.rule && <hr className="border-osrs-bronze/30" />}</div>;
    }
    case "custom_html":
      return block.html ? (
        <div
          className="site-custom-html max-w-none"
          dangerouslySetInnerHTML={{ __html: block.html }}
        />
      ) : (
        <PlaceholderCard
          type="custom_html"
          detail="The sanitized preview appears after your first save."
        />
      );
    case "lootboard":
      return <PlaceholderCard type="lootboard" detail={`Period: ${block.period}`} />;
    case "pb_board":
      return (
        <PlaceholderCard
          type="pb_board"
          detail={block.boss_id ? `Boss #${block.boss_id}` : "Your most-contested boss"}
        />
      );
    case "leaderboard":
      return <PlaceholderCard type="leaderboard" detail={`Top ${block.limit}, live updates`} />;
    case "npc_board":
      return (
        <PlaceholderCard
          type="npc_board"
          detail={block.npc_id ? `Boss #${block.npc_id} · ${block.period}` : "Set a boss NPC id"}
        />
      );
    case "recap":
      return <PlaceholderCard type="recap" detail={`Latest ${block.period}ly recap`} />;
    case "announcements":
      return <PlaceholderCard type="announcements" detail={`Latest ${block.limit}`} />;
    case "live_ticker":
      return <PlaceholderCard type="live_ticker" detail="Real-time clan drop feed" />;
    case "wom_achievements":
      return <PlaceholderCard type="wom_achievements" detail={`Latest ${block.limit} milestones`} />;
    case "member_roster":
      return <PlaceholderCard type="member_roster" detail={`Top ${block.limit} by monthly loot`} />;
    case "event_standings":
      return (
        <PlaceholderCard
          type="event_standings"
          detail={block.event_id ? `Event #${block.event_id}` : "Newest active event"}
        />
      );
    default:
      return null;
  }
}

export function BlockPreview({ block, group }: { block: Block; group: GroupProfile }) {
  const parsed = SiteBlockSchema.safeParse(block);
  if (!parsed.success) {
    return (
      <PlaceholderCard
        type={(block.type as string) ?? "?"}
        detail="This block needs configuration before it can render."
      />
    );
  }
  return <>{renderPreview(parsed.data, group)}</>;
}
