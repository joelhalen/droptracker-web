import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { api } from "@/lib/api";

// Static public routes + docs. Dynamic player/group entries will be added once
// the Web API can enumerate them.
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
  const docs = await api.docs();

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
  ];
}
