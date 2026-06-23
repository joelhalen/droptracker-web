/**
 * BFF: SSE proxy (FRONTEND_PLAN.md §8.1). The browser connects here; we relay
 * the Web API's `/api/v1/stream` (which fans out Redis pub/sub). Keeping the
 * stream same-origin means no CORS and the session cookie is forwarded
 * server-side.
 *
 * When the Web API is unreachable and mocks are enabled, we synthesize periodic
 * `leaderboard_delta` events so the live UI is demonstrable before the backend
 * exists.
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

/** Synthetic SSE source used only as a dev/mock fallback. */
function mockStream(channels: string, signal: AbortSignal): ReadableStream {
  const encoder = new TextEncoder();
  const scope = channels.split(",")[0] ?? "global";
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": connected (mock)\n\n"));
      const interval = setInterval(() => {
        const rank = 1 + Math.floor(Math.random() * 5);
        const delta = Math.round(Math.random() * 50_000_000);
        const event = {
          v: 1,
          type: "leaderboard_delta",
          scope,
          ts: Math.floor(Date.now() / 1000),
          data: { id: 1000 + rank, rank, delta },
        };
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
