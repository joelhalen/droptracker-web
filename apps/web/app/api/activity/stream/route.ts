/**
 * BFF: SSE proxy variant for the Discord Activity. Identical to /api/stream
 * except auth: EventSource can't set an Authorization header and the iframe
 * can't hold the dt_session cookie, so a session-gated scope (player:{id})
 * passes the JWT as a `token` query param and we forward it upstream as the
 * cookie. Anonymous scopes work with no token, same as /api/stream.
 */
import type { NextRequest } from "next/server";
import { env, SESSION_COOKIE } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const channels = req.nextUrl.searchParams.get("channels") ?? "feed";
  const token = (req.nextUrl.searchParams.get("token") ?? "").trim();
  const upstreamUrl = `${env.webApiInternalUrl}/api/v1/stream?channels=${encodeURIComponent(channels)}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        accept: "text/event-stream",
        ...(token ? { cookie: `${SESSION_COOKIE}=${token}` } : {}),
      },
      signal: req.signal,
    });
    if (!upstream.ok || !upstream.body) {
      return new Response(`upstream ${upstream.status}`, { status: 502 });
    }
    return new Response(upstream.body, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  } catch (err) {
    return new Response(`upstream unavailable: ${(err as Error).message}`, { status: 502 });
  }
}
