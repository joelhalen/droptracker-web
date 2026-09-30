/**
 * Social-card images: `/api/og/{players|groups|npcs|items}/{id}.png`.
 *
 * Referenced as `og:image` / `twitter:image` by each entity page's
 * `generateMetadata` (see `lib/seo.ts`), so a pasted link unfurls with a
 * picture of the thing and its headline numbers rather than the site logo.
 * Layout lives in `lib/og/card.tsx`.
 *
 * Under /api/ so the redirect middleware skips it, and ending in `.png` so
 * Cloudflare caches it by extension. Any failure still answers with an image
 * (the default art), because a crawler that gets a 500 caches "no preview".
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { api } from "@/lib/api";
import { accountTypeDisplay } from "@/lib/account-types";
import {
  FittedImage,
  InitialTile,
  loadImage,
  renderCard,
  type CardStat,
  type LoadedImage,
} from "@/lib/og/card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ kind: string; file: string }>;

const num = (n: number) => n.toLocaleString("en-US");
const gp = (m?: { value_formatted: string } | null) => (m ? `${m.value_formatted} GP` : "—");

/** A self-hosted file under public/, read from disk (it never needs HTTP). */
async function loadPublicImage(path: string): Promise<LoadedImage | null> {
  try {
    const buf = await readFile(join(process.cwd(), "public", path.replace(/^\/+/, "")));
    if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
    return {
      src: `data:image/png;base64,${buf.toString("base64")}`,
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
    };
  } catch {
    return null;
  }
}

async function playerCard(id: number) {
  const player = await api.player(id);
  const account = accountTypeDisplay(player.account_type);
  const [model, helm] = await Promise.all([
    player.model_fingerprint
      ? loadImage(`/img/models/${player.id}/${player.model_fingerprint}.png`)
      : null,
    account ? loadPublicImage(account.icon) : null,
  ]);

  const stats: CardStat[] = [
    { label: "Monthly loot", value: gp(player.total_loot) },
    {
      label: "Global rank",
      value: player.global_rank != null ? `#${num(player.global_rank)}` : "Unranked",
    },
  ];
  const topBoss = player.top_bosses?.[0]?.name ?? player.top_npc;
  if (topBoss) stats.push({ label: "Top boss", value: topBoss });
  if (player.groups[0]) stats.push({ label: "Group", value: player.groups[0].name });
  else if (player.points) stats.push({ label: "Points", value: num(player.points) });

  // Renders are 800×1200 with the figure in roughly y 270..940. Crop with
  // negative margins (satori centres absolutely positioned children in a flex
  // box, so offsets there land somewhere else) so the figure fills the height.
  const MODEL_H = 1000;
  const modelW = model ? Math.round((model.width / model.height) * MODEL_H) : 0;
  const visual = model ? (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        width: 440,
        height: 630,
        overflow: "hidden",
        background:
          "radial-gradient(ellipse 160px 26px at 50% 94%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)",
      }}
    >
      <img
        src={model.src}
        alt=""
        width={modelW}
        height={MODEL_H}
        style={{ flexShrink: 0, marginTop: -195, marginLeft: Math.round((440 - modelW) / 2) }}
      />
    </div>
  ) : (
    <InitialTile name={player.name} size={300} />
  );

  return renderCard({
    kicker: "Player",
    title: player.name,
    subtitle: account?.label ?? (player.is_supporter ? "Supporter" : "Old School RuneScape"),
    subtitleIcon: helm,
    stats,
    visual,
  });
}

async function groupCard(id: number) {
  const group = await api.group(id);
  // The icon when the group has one, else its lootboard, else a letter tile.
  const icon = await loadImage(group.icon_url);
  const lootboard = icon ? null : await loadImage(`/img/clans/${group.id}/lb/lootboard.png`);

  const stats: CardStat[] = [
    { label: "Members", value: num(group.member_count) },
    { label: "Monthly loot", value: gp(group.monthly_loot) },
  ];
  if (group.global_rank != null)
    stats.push({ label: "Global rank", value: `#${num(group.global_rank)}` });
  const top = group.top_players?.[0]?.name ?? group.top_player?.name;
  if (top) stats.push({ label: "Top earner", value: top });

  let visual;
  let visualWidth = 440;
  if (icon) {
    visual = <FittedImage image={icon} box={{ width: 340, height: 340 }} radius={40} />;
  } else if (lootboard) {
    visualWidth = 500;
    visual = (
      <FittedImage image={lootboard} box={{ width: 500, height: 520 }} radius={14} glow={null} />
    );
  } else {
    visual = <InitialTile name={group.name} size={300} />;
  }

  return renderCard({
    kicker: group.flair ? `Group · ${group.flair.tier_name}` : "Group",
    title: group.name,
    subtitle:
      group.description && group.description !== "An Old School RuneScape group."
        ? truncate(group.description, 60)
        : "Old School RuneScape clan",
    stats,
    visual,
    visualWidth,
  });
}

async function npcCard(id: number) {
  const npc = await api.npcDetail(id);
  if (!npc) return null;
  const icon = await loadImage(npc.icon_url);
  const stats: CardStat[] = [
    { label: "Loot tracked", value: gp(npc.lifetime.loot) },
    { label: "Drops", value: num(npc.lifetime.drop_count) },
    { label: "This month", value: gp(npc.month.loot) },
  ];
  const top = npc.top_players[0];
  if (top) stats.push({ label: "Top looter", value: top.player_name });
  return renderCard({
    kicker: "Boss",
    title: npc.name,
    subtitle: `${num(npc.lifetime.unique_players)} players tracked`,
    stats,
    visual: icon ? (
      <FittedImage image={icon} box={{ width: 400, height: 460 }} />
    ) : (
      <InitialTile name={npc.name} size={300} />
    ),
  });
}

async function itemCard(id: number) {
  const item = await api.itemDetail(id);
  if (!item) return null;
  const icon = await loadImage(item.icon_url);
  const stats: CardStat[] = [];
  if (item.lifetime) {
    stats.push({ label: "Times received", value: num(item.lifetime.drop_count) });
    stats.push({ label: "Players", value: num(item.lifetime.unique_players) });
    stats.push({ label: "Total value", value: gp(item.lifetime.loot) });
  }
  const source = item.sources.npcs[0];
  if (source) stats.push({ label: "Dropped by", value: source.name });
  return renderCard({
    kicker: "Item",
    title: item.name,
    subtitle: item.ge_value ? `GE price ${item.ge_value.value_formatted} GP` : "Untradeable",
    stats,
    // Sprites are ~36×32: scale by a whole number so the pixel art stays crisp.
    visual: icon ? (
      <FittedImage
        image={icon}
        box={{
          width: icon.width * Math.max(1, Math.floor(300 / Math.max(icon.width, icon.height))),
          height: icon.height * Math.max(1, Math.floor(300 / Math.max(icon.width, icon.height))),
        }}
        pixelated
      />
    ) : (
      <InitialTile name={item.name} size={300} />
    ),
  });
}

function truncate(s: string, max: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

const CARDS = {
  players: playerCard,
  groups: groupCard,
  npcs: npcCard,
  items: itemCard,
} as const;

function fallback() {
  return new Response(null, { status: 302, headers: { location: "/og-default.png" } });
}

export async function GET(_request: Request, { params }: { params: Params }) {
  const { kind, file } = await params;
  const match = /^(\d+)\.png$/.exec(file);
  if (!match || !Object.prototype.hasOwnProperty.call(CARDS, kind)) {
    return new Response("Not found", { status: 404 });
  }
  const id = Number(match[1]);
  try {
    const card = await CARDS[kind as keyof typeof CARDS](id);
    if (!card) return fallback();
    // ImageResponse renders lazily as it streams, so a layout error would
    // surface after this handler returned. Buffer it here, inside the try.
    const body = await card.arrayBuffer();
    return new Response(body, { status: 200, headers: card.headers });
  } catch (err) {
    console.error(`og card ${kind}/${id} failed:`, err);
    return fallback();
  }
}
