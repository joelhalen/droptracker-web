/**
 * BFF: SSE proxy (FRONTEND_PLAN.md §8.1). The browser connects here; we relay
 * the Web API's `/api/v1/stream` (which fans out Redis pub/sub). Keeping the
 * stream same-origin means no CORS and the session cookie is forwarded
 * server-side.
 *
 * When the Web API is unreachable and mocks are enabled, we synthesize periodic
 * `leaderboard_delta` (or, on the "feed" scope, `drop`) events so the live UI is
 * demonstrable before the backend exists.
 */
import type { NextRequest } from "next/server";
import { env, SESSION_COOKIE } from "@/lib/env";

export const dynamic = "force-dynamic";

const SSE_HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
};

export async function GET(req: NextRequest) {
  const channels = req.nextUrl.searchParams.get("channels") ?? "global";
  const upstreamUrl = `${env.webApiInternalUrl}/api/v1/stream?channels=${encodeURIComponent(channels)}`;
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        accept: "text/event-stream",
        ...(token ? { cookie: `${SESSION_COOKIE}=${token}` } : {}),
      },
      signal: req.signal,
    });
    if (upstream.ok && upstream.body) {
      return new Response(upstream.body, { headers: SSE_HEADERS });
    }
    throw new Error(`upstream ${upstream.status}`);
  } catch (err) {
    if (!env.useMockApi) {
      return new Response(`upstream unavailable: ${(err as Error).message}`, { status: 502 });
    }
    return new Response(mockStream(channels, req.signal), { headers: SSE_HEADERS });
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

/** Synthetic SSE source used only as a dev/mock fallback. */
function mockStream(channels: string, signal: AbortSignal): ReadableStream {
  const encoder = new TextEncoder();
  const scope = channels.split(",")[0] ?? "global";
  const isFeed = scope === "feed";
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": connected (mock)\n\n"));
      const interval = setInterval(() => {
        const event = isFeed ? mockDropEvent() : mockLeaderboardDeltaEvent(scope);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }, 4000);

      const stop = () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      signal.addEventListener("abort", stop);
    },
  });
}

function mockLeaderboardDeltaEvent(scope: string) {
  const rank = 1 + Math.floor(Math.random() * 5);
  const delta = Math.round(Math.random() * 50_000_000);
  return {
    v: 1,
    type: "leaderboard_delta",
    scope,
    ts: Math.floor(Date.now() / 1000),
    data: { id: 1000 + rank, rank, delta },
  };
}

function mockDropEvent() {
  const item = MOCK_ITEMS[Math.floor(Math.random() * MOCK_ITEMS.length)]!;
  const npc = MOCK_NPCS[Math.floor(Math.random() * MOCK_NPCS.length)]!;
  const player = MOCK_PLAYERS[Math.floor(Math.random() * MOCK_PLAYERS.length)]!;
  const value = 1_000_000 + Math.round(Math.random() * 900_000_000);
  return {
    v: 1,
    type: "drop",
    scope: "feed",
    ts: Math.floor(Date.now() / 1000),
    data: {
      player_id: 1000 + Math.floor(Math.random() * 20),
      player_name: player,
      item_name: item.name,
      icon_url: `https://www.droptracker.io/img/itemdb/${item.icon}.png`,
      npc_name: npc,
      value,
    },
  };
}
