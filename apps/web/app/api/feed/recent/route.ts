/**
 * BFF: recent drop-feed history. Backs the live ticker's initial hydration so
 * it shows past drops immediately on page load instead of an empty state
 * while waiting for the next SSE `drop` event. Relays the Web API's
 * `/api/v1/feed/recent`, which reads a capped Redis list populated by
 * `services/realtime.py::publish_drop`.
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
  return Array.from({ length: 8 }, (_, i) => {
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
        value: 1_000_000 + i * 50_000_000,
      },
    };
  });
}
