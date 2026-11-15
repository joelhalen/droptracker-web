import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * Per-player deep pages are closed to crawlers: there is one of each for every
 * tracked player, they are the expensive ones to build, and they have little
 * search value. On 2026-11-14 crawlers were ~60% of non-plugin traffic and
 * spent most of it walking these by player id. The main player and group
 * pages, leaderboards and docs stay open.
 *
 * `*` covers both URL shapes (`/players/123/recap` and `/players/123-name/recap`).
 * A crawler that ignores robots.txt needs a Cloudflare rule instead.
 */
export const CRAWLER_DISALLOW = [
  "/players/*/recap",
  "/players/*/collection-log",
  "/players/*/achievements",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: CRAWLER_DISALLOW },
    // siteUrl may carry a trailing slash, which used to publish `//sitemap.xml`.
    sitemap: `${env.siteUrl.replace(/\/+$/, "")}/sitemap.xml`,
  };
}
