import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The api-types package is consumed as TS source from the workspace.
  transpilePackages: ["@droptracker/api-types"],
  typedRoutes: true,
  async redirects() {
    // 301 map from legacy XenForo URLs (FRONTEND_PLAN.md §14.2).
    return [
      { source: "/leaderboard", destination: "/leaderboards", permanent: true },
      { source: "/players/ranks", destination: "/leaderboards", permanent: true },
      { source: "/players/view/:id(\\d+)", destination: "/players/:id", permanent: true },
      { source: "/groups/create", destination: "/groups/new", permanent: true },
      { source: "/account/droptracker", destination: "/settings", permanent: true },
      { source: "/account/premium", destination: "/settings/premium", permanent: true },
    ];
  },
};

export default nextConfig;
