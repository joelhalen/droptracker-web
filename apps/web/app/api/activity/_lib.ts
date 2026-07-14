/**
 * Shared helpers for the /api/activity/* BFF routes (not a route itself).
 *
 * Two jobs:
 *  - `upstreamGet` — the one door to the Web API for activity reads, with the
 *    bearer→dt_session-cookie translation the iframe auth model requires.
 *  - `rewriteImgUrls` — the CSP shim. Upstream payloads carry absolute
 *    `https://www.droptracker.io/img/...` icon/image URLs everywhere; inside
 *    the discordsays.com iframe those are cross-origin and blocked. The
 *    activity host (activity.droptracker.io) proxies `/img/` in nginx, so
 *    rewriting the prefix to a relative path makes every icon same-origin —
 *    one shim at the BFF boundary instead of per-component forks.
 */
import type { NextRequest } from "next/server";
import { env, SESSION_COOKIE } from "@/lib/env";

const ABS_IMG = /https:\/\/(?:www\.)?droptracker\.io\/img/g;

export function rewriteImgUrls<T>(payload: T): T {
  return JSON.parse(JSON.stringify(payload).replace(ABS_IMG, "/img")) as T;
}

export function bearerFrom(req: NextRequest): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

export class UpstreamError extends Error {
  constructor(public status: number) {
    super(`upstream ${status}`);
  }
}

export async function upstreamGet(
  path: string,
  opts: { bearer?: string; revalidate?: number } = {},
): Promise<unknown> {
  const res = await fetch(`${env.webApiInternalUrl}/api/v1${path}`, {
    headers: {
      accept: "application/json",
      ...(opts.bearer ? { cookie: `${SESSION_COOKIE}=${opts.bearer}` } : {}),
    },
    // Authed reads must never be cached across viewers.
    ...(opts.bearer
      ? { cache: "no-store" as const }
      : opts.revalidate != null
        ? { next: { revalidate: opts.revalidate } }
        : {}),
  });
  if (!res.ok) throw new UpstreamError(res.status);
  return res.json();
}
