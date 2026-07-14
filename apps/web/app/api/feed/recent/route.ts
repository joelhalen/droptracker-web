/**
 * BFF: recent activity-feed history. Backs the live ticker's initial
 * hydration so it shows past events immediately on page load instead of an
 * empty state while waiting for the next SSE event. Relays the Web API's
 * `/api/v1/feed/recent`, which reads a capped Redis list of typed envelopes
 * (drop / personal_best / pet / group_created / new_player / subscription)
 * populated by `services/realtime.py`.
 */
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const upstreamUrl = `${env.webApiInternalUrl}/api/v1/feed/recent`;

  try {
    const upstream = await fetch(upstreamUrl, { cache: "no-store" });
    if (upstream.ok) {
      const data = await upstream.json();
      return NextResponse.json(data);
    }
    throw new Error(`upstream ${upstream.status}`);
  } catch (err) {
    if (!env.useMockApi) {
      return NextResponse.json({ error: (err as Error).message }, { status: 502 });
    }
    return NextResponse.json(mockRecentFeed());
  }
}

const MOCK_ITEMS = [
  { name: "Twisted bow", icon: 20997 },
  { name: "Scythe of vitur", icon: 22325 },
  { name: "Elysian spirit shield", icon: 12817 },
  { name: "Tumeken's shadow", icon: 27275 },
  { name: "Dragon claws", icon: 13652 },
];
const MOCK_NPCS = ["Vorkath", "Zulrah", "Theatre of Blood", "Alchemical Hydra", "Nex"];
const MOCK_PLAYERS = ["Zezima", "Woox", "Torvesta", "Framed", "B0aty"];

/** Synthetic history used only as a dev/mock fallback. */
function mockRecentFeed() {
  const now = Math.floor(Date.now() / 1000);
  const drops = Array.from({ length: 6 }, (_, i) => {
    const item = MOCK_ITEMS[i % MOCK_ITEMS.length]!;
    const npc = MOCK_NPCS[i % MOCK_NPCS.length]!;
    const player = MOCK_PLAYERS[i % MOCK_PLAYERS.length]!;
    return {
      v: 1,
      type: "drop",
      scope: "feed",
      data: {
        ts: now - i * 60,
        player_id: 1000 + i,
        player_name: player,
        item_name: item.name,
        icon_url: `https://www.droptracker.io/img/itemdb/${item.icon}.png`,
        npc_name: npc,
        value: 10_000_000 + i * 50_000_000,
      },
    };
  });
  // One of each non-drop ticker type so dev mode exercises every renderer.
  const extras = [
    {
      type: "personal_best",
      data: {
        player_id: 1001,
        player_name: "Woox",
        npc_id: 13699,
        npc_name: "Theatre of Blood",
        npc_icon_url: "https://www.droptracker.io/img/npcdb/13699.png",
        time_ms: 833_400,
        time_display: "13:53.4",
        team_size: "5",
        rank: 2,
      },
    },
    {
      type: "pet",
      data: {
        player_id: 1002,
        player_name: "B0aty",
        pet_name: "Ikkle hydra",
        item_id: 22746,
        icon_url: "https://www.droptracker.io/img/itemdb/22746.png",
      },
    },
    { type: "group_created", data: { group_id: 42, group_name: "Iron Legion" } },
    {
      type: "new_player",
      data: { player_id: 1003, player_name: "Zezima", player_number: 25_431 },
    },
    { type: "subscription", data: { kind: "group", group_id: 42, name: "Iron Legion" } },
    { type: "subscription", data: { kind: "user", player_id: 1004, name: "Framed" } },
  ].map((e, i) => ({ v: 1, scope: "feed", ...e, data: { ts: now - 30 - i * 90, ...e.data } }));

  // Interleave so the mock marquee mixes types like production does.
  return drops.flatMap((d, i) => (extras[i] ? [d, extras[i]] : [d]));
}
