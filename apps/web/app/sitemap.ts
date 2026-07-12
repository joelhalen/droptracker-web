import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { api } from "@/lib/api";
import { entityPath } from "@/lib/slug";

// The most-visited pages plus DB-backed docs and the top players/groups (the
// leaderboards are the enumeration source). Entity URLs use the pretty slug so
// the sitemap reinforces the canonical form; the id URLs still resolve. NPCs
// and items are discovered by crawlers via the entity pages' internal links.
const TOP_GROUP_PAGES = 2; // × 100 = up to 200 groups
const TOP_PLAYER_PAGES = 5; // × 100 = up to 500 players

async function topEntities(
  fetchPage: (page: number) => Promise<{ entries: { id: number; name: string }[] }>,
  pages: number,
): Promise<{ id: number; name: string }[]> {
  const out: { id: number; name: string }[] = [];
  for (let page = 1; page <= pages; page++) {
    try {
      const res = await fetchPage(page);
      if (res.entries.length === 0) break;
      out.push(...res.entries);
    } catch {
      break; // best-effort: a failed page just trims the sitemap
    }
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl;
  const staticPaths = [
    "/",
    "/leaderboards",
    "/personal-bests",
    "/events",
    "/announcements",
    "/premium",
    "/docs",
  ];

  const [docs, groups, players] = await Promise.all([
    api.docs().catch(() => []),
    topEntities((page) => api.groupLeaderboard({ period: "all", page, limit: 100 }), TOP_GROUP_PAGES),
    topEntities((page) => api.playerLeaderboard({ period: "all", page, limit: 100 }), TOP_PLAYER_PAGES),
  ]);

  return [
    ...staticPaths.map((path) => ({
      url: `${base}${path}`,
      changeFrequency: "hourly" as const,
      priority: path === "/" ? 1 : 0.7,
    })),
    ...docs.map((d) => ({
      url: `${base}/docs/${d.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...groups.map((g) => ({
      url: `${base}${entityPath("groups", g.id, g.name)}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    ...players.map((p) => ({
      url: `${base}${entityPath("players", p.id, p.name)}`,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
  ];
}
