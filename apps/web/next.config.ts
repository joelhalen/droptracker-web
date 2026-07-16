import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lint is a CI/dev concern, not a build/deploy concern. `next build` runs its
  // OWN ESLint pass with different behaviour than `eslint .` — most painfully,
  // it hard-errors on a disable-directive for a rule the flat config doesn't
  // register (e.g. `// eslint-disable react-hooks/exhaustive-deps`, which the
  // `eslint .` Lint step silently ignores). That divergence made green Lint +
  // Typecheck + Test but a RED deploy build the recurring failure mode. The
  // single source of truth for lint is the CI `Lint` step (`pnpm lint`) and the
  // local `pnpm lint`; the build only builds. Type safety is unaffected — `next
  // build` still type-checks via tsc, and CI has a separate Typecheck step.
  eslint: { ignoreDuringBuilds: true },
  // Blue-green deploys build each colour into its own output dir so a live
  // instance's build is never overwritten while it serves (deploy-web.sh sets
  // NEXT_DIST_DIR per colour). Defaults to `.next` for local dev / plain builds.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // The api-types package is consumed as TS source from the workspace.
  transpilePackages: ["@droptracker/api-types"],
  typedRoutes: true,
  experimental: {
    // Group-icon uploads travel through a Server Action as multipart FormData;
    // the backend caps icons at 2 MB, so allow headroom over the 1 MB default.
    serverActions: { bodySizeLimit: "3mb" },
  },
  async rewrites() {
    // Legacy PayPal IPN endpoint. Pre-cutover group subscriptions are PayPal
    // agreements whose notification URL was baked in by XenForo as
    // {boardUrl}/payment_callback.php?_xfProvider=paypal — PayPal keeps
    // POSTing renewals there forever, so once this app serves the domain the
    // path must proxy to the Web API's IPN handler (web_api/routes/paypal_ipn.py).
    const webApiUrl = process.env.WEB_API_INTERNAL_URL ?? "http://localhost:31325";
    return {
      // beforeFiles: must win over the filesystem route for `/` (the homepage).
      beforeFiles: [
        // Discord Activity host. The activity iframe always loads the ROOT
        // path of <app-id>.discordsays.com, whose URL mapping targets
        // activity.droptracker.io — so `/` on that host must serve the
        // activity app, not the site homepage. Internal rewrite (URL stays /,
        // frame_id & friends survive in the query string).
        {
          source: "/",
          has: [{ type: "host", value: "activity.droptracker.io" }],
          destination: "/activity",
        },
      ],
      afterFiles: [
        {
          source: "/payment_callback.php",
          destination: `${webApiUrl}/api/v1/webhooks/paypal-ipn`,
        },
        // Stripe billing webhook. web_api (:31325) is internal-only — nginx only
        // exposes this app — so Stripe's dashboard-configured endpoint must be a
        // public path on this domain, proxied straight through. This is a raw
        // rewrite (not a Route Handler) so the exact request bytes reach
        // web_api untouched; Stripe's signature is computed over those bytes
        // (web_api/routes/subscriptions.py::billing_webhook / billing.py::verify_webhook).
        {
          source: "/api/webhooks/stripe",
          destination: `${webApiUrl}/api/v1/webhooks/billing`,
        },
      ],
    };
  },
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
      // XF-era points URL. Temporary (307) on purpose: the pre-2026-07-08
      // permanent 308 → /groups/:id got cached by browsers and is exactly why
      // the admin page lives at /points/manage instead of /points.
      { source: "/groups/:id(\\d+)/points", destination: "/groups/:id/points/manage", permanent: false },

      // NPC / item pages. The per-boss PB page grew into the full NPC page
      // (drop table + loot totals + PB boards), so old links land there; the
      // XF-era "view/{id}" spellings map to the same pages.
      { source: "/personal-bests/:id(\\d+)", destination: "/npcs/:id", permanent: true },
      { source: "/personal_best/:id(\\d+)", destination: "/npcs/:id", permanent: true },
      { source: "/npcs/view/:id(\\d+)", destination: "/npcs/:id", permanent: true },
      { source: "/items/view/:id(\\d+)", destination: "/items/:id", permanent: true },

      // Subscriptions (was feature store, now per-group subscription)
      { source: "/feature-store/:id(\\d+)", destination: "/groups/:id/subscription", permanent: true },

      // Account
      { source: "/account/droptracker", destination: "/settings", permanent: true },
      { source: "/account/premium", destination: "/settings", permanent: true },

      // External shortlinks used by the Discord bot, RuneLite plugin, and old docs.
      // /discord is intentionally NOT permanent: invite links can be rotated, and a
      // 308 would let browsers cache a dead invite forever.
      { source: "/discord", destination: "https://discord.gg/dvb7yP7JJH", permanent: false },
      {
        source: "/invite",
        destination: "https://discord.com/oauth2/authorize?client_id=1172933457010245762",
        permanent: true,
      },
      {
        source: "/runelite",
        destination: "https://runelite.net/plugin-hub/show/droptracker",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
