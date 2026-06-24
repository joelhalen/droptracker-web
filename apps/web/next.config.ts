import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The api-types package is consumed as TS source from the workspace.
  transpilePackages: ["@droptracker/api-types"],
  typedRoutes: true,
  async redirects() {
    // 301 map from legacy XenForo URLs (FRONTEND_PLAN.md §14.2). Targets are the
    // closest equivalent route that exists today; pages not yet built fall back
    // to the nearest parent so links never 404.
    return [
      // Leaderboards
      { source: "/leaderboard", destination: "/leaderboards", permanent: true },
      { source: "/players/ranks", destination: "/leaderboards", permanent: true },

      // Players
      { source: "/players", destination: "/leaderboards", permanent: true },
      { source: "/players/view/:id(\\d+)", destination: "/players/:id", permanent: true },
      // Non-numeric "view/{name}" → search by name
      { source: "/players/view/:name", destination: "/search?q=:name", permanent: true },
      { source: "/players/:id(\\d+)/points", destination: "/players/:id", permanent: true },

      // Groups
      { source: "/groups", destination: "/leaderboards", permanent: true },
      { source: "/groups/create", destination: "/groups/new", permanent: true },
      { source: "/groups/:id(\\d+)/config", destination: "/groups/:id/settings", permanent: true },
      { source: "/groups/:id(\\d+)/dashboard", destination: "/groups/:id/admin", permanent: true },
      { source: "/groups/:id(\\d+)/manual-submission", destination: "/submit", permanent: true },
      { source: "/groups/:id(\\d+)/board-generator", destination: "/groups/:id/lootboard", permanent: true },
      { source: "/groups/:id(\\d+)/points", destination: "/groups/:id", permanent: true },

      // Subscriptions (was feature store, now per-group subscription)
      { source: "/feature-store/:id(\\d+)", destination: "/groups/:id/subscription", permanent: true },

      // Account
      { source: "/account/droptracker", destination: "/settings", permanent: true },
      { source: "/account/premium", destination: "/settings", permanent: true },
    ];
  },
};

export default nextConfig;
