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

/** Hosts the same-origin board-img proxy is allowed to fetch from. Board
 * backgrounds live on the B2 CDN (videos.droptracker.io); the sample art on
 * www — both cross-origin to the activity host and blocked by its CSP. */
export const BOARD_IMG_HOSTS = new Set([
  "videos.droptracker.io",
  "www.droptracker.io",
  "droptracker.io",
]);

/** Rewrite an absolute board image URL to the same-origin proxy path, or return
 * it unchanged when it's already relative (e.g. /img/...) or not proxied. */
export function proxiedBoardImg(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.protocol !== "https:" || !BOARD_IMG_HOSTS.has(parsed.hostname)) return url;
  return `/api/activity/board-img?u=${encodeURIComponent(url)}`;
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

/**
 * Forward a bearer-authed write to the Web API, returning the raw upstream
 * Response so the caller can pass the status + RFC-7807 problem body straight
 * through (the join/completion-action routes' translation, factored out for the
 * board write routes). Translates the bearer header into the dt_session cookie.
 */
export async function upstreamForward(
  method: string,
  path: string,
  bearer: string,
  body: unknown = {},
): Promise<Response> {
  return fetch(`${env.webApiInternalUrl}/api/v1${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      cookie: `${SESSION_COOKIE}=${bearer}`,
    },
    body: JSON.stringify(body),
  });
}
