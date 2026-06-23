import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

// Static public routes. Dynamic player/group entries will be added once the
// Web API can enumerate them.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.siteUrl;
  return ["/", "/leaderboards", "/announcements"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "hourly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
