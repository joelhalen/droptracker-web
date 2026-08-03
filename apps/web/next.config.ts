import type { NextConfig } from "next";

/** One entry of `redirects()`, derived from the public config type rather than
 *  reaching into `next/dist` for it. */
type Redirect = Awaited<ReturnType<NonNullable<NextConfig["redirects"]>>>[number];

/**
 * One legacy XenForo entity action, in both ref spellings XF emitted:
 * `/groups/PlayTheGame.176/config` and — for a row with no title —
 * `/groups/176/config`. Both collapse to the bare numeric id, which every
 * current route accepts. See the note at the top of `redirects()`.
 *
 * `action` is the path AFTER the ref (`""` for the ref on its own, which only
 * gets the titled spelling — `/groups/176` is already a current URL and would
 * redirect to itself). `destination` is the current path, using `:id`.
 */
function xf(kind: string, action: string, destination: string, permanent = true): Redirect[] {
  const refs = action === "" ? [":name.:id(\\d+)"] : [":name.:id(\\d+)", ":id(\\d+)"];
  return refs.map((ref) => ({ source: `/${kind}/${ref}${action}`, destination, permanent }));
}

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
    // unauthorized()/forbidden() interrupts (web57a access-denied pages): role
    // failures render app/(site)/{unauthorized,forbidden}.tsx with real
    // 401/403 statuses instead of silently redirecting home.
    authInterrupts: true,
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
    //
    // XF wrote every entity URL as `{Title}.{id}` with the action on the end —
    // `/groups/PlayTheGame.176/view`, `/players/Zezima.5/drops`,
    // `/npcs/Vorkath.8060/view/page-2` — and dropped the title only for a row
    // that had none (`/groups/176/view`). The `xf()` helper below emits both
    // spellings of each action and lands on the bare id, which every current
    // route accepts. Unwrapping here rather than in the page is deliberate:
    // this is a real 308, whereas a redirect thrown from an entity page would
    // arrive as an in-band 200 (`(public)/loading.tsx` puts every public page
    // behind a Suspense boundary, so the shell has already been flushed by the
    // time the profile loads). `/groups/176` then declares
    // `/groups/playthegame` as its canonical URL for crawlers, the same as
    // every other id link the app and the Discord bot hand out.
    return [
      // Leaderboards
      { source: "/leaderboard", destination: "/leaderboards", permanent: true },
      { source: "/players/ranks", destination: "/leaderboards", permanent: true },

      // Players. `view` paginated as `/view/page-2`; the other actions were
      // partials and forms whose job the profile page now does inline.
      { source: "/players", destination: "/leaderboards", permanent: true },
      { source: "/players/filter", destination: "/leaderboards", permanent: true },
      { source: "/players/highlighted", destination: "/leaderboards", permanent: true },
      { source: "/players/view/:id(\\d+)", destination: "/players/:id", permanent: true },
      // Non-numeric "view/{name}" → search by name
      { source: "/players/view/:name", destination: "/search?q=:name", permanent: true },
      ...xf("players", "", "/players/:id"),
      ...xf("players", "/view/:page*", "/players/:id"),
      ...xf(
        "players",
        "/:action(points|drops|tooltip|edit|disassociate|top-ranks|top-ranks-request|top-ranks-tooltip)",
        "/players/:id",
      ),

      // Groups
      { source: "/groups", destination: "/leaderboards", permanent: true },
      { source: "/groups/highlighted", destination: "/leaderboards", permanent: true },
      { source: "/groups/create", destination: "/groups/new", permanent: true },
      // XF ran group creation as a multi-step wizard under /groups/create/*.
      { source: "/groups/create/:step*", destination: "/groups/new", permanent: true },
      ...xf("groups", "", "/groups/:id"),
      ...xf("groups", "/view/:page*", "/groups/:id"),
      ...xf("groups", "/:action(tooltip|rank-ajax)", "/groups/:id"),
      ...xf("groups", "/manual-submission", "/submit"),
      ...xf("groups", "/:action(config|edit)", "/groups/:id/settings"),
      ...xf("groups", "/dashboard", "/groups/:id/admin"),
      ...xf("groups", "/:action(member-list|hidden-players|wom-sync)", "/groups/:id/members"),
      ...xf("groups", "/:action(board-generator|board-selection)", "/groups/:id/lootboard"),
      // The feature store became the per-group subscription; XF hung both a
      // top-level and a group-scoped copy off every group.
      ...xf("groups", "/:action(upgrades|feature-store)/:rest*", "/groups/:id/subscription"),
      // Public points standings (XF: points-dashboard/group-points, paginated).
      ...xf("groups", "/:action(points-dashboard|group-points)/:page*", "/groups/:id/points/leaderboard"),
      ...xf("groups", "/point-awards/save", "/groups/:id/points/manage"),
      // XF-era points URL. Temporary (307) on purpose: the pre-2026-07-08
      // permanent 308 → /groups/:id got cached by browsers and is exactly why
      // the admin page lives at /points/manage instead of /points.
      ...xf("groups", "/points", "/groups/:id/points/manage", false),

      // NPC / item pages. The per-boss PB page grew into the full NPC page
      // (drop table + loot totals + PB boards), so old links land there; the
      // XF-era "view/{id}" spellings map to the same pages.
      { source: "/personal-bests/:id(\\d+)", destination: "/npcs/:id", permanent: true },
      { source: "/personal_bests", destination: "/personal-bests", permanent: true },
      { source: "/personal_best", destination: "/personal-bests", permanent: true },
      { source: "/personal_best/:id(\\d+)", destination: "/npcs/:id", permanent: true },
      ...xf("personal_best", "/view/:page*", "/npcs/:id"),
      { source: "/npcs/view/:id(\\d+)", destination: "/npcs/:id", permanent: true },
      { source: "/npcs/search", destination: "/search", permanent: true },
      ...xf("npcs", "", "/npcs/:id"),
      ...xf("npcs", "/view/:page*", "/npcs/:id"),
      ...xf("npcs", "/:action(drops|tooltip|top-players|last-player-drop)/:rest*", "/npcs/:id"),
      { source: "/items/view/:id(\\d+)", destination: "/items/:id", permanent: true },
      { source: "/items/search", destination: "/search", permanent: true },
      ...xf("items", "", "/items/:id"),
      ...xf("items", "/view/:page*", "/items/:id"),
      ...xf("items", "/tooltip", "/items/:id"),

      // Subscriptions (was feature store, now per-group subscription).
      // `:rest*` matches zero segments, so this covers the bare ref too.
      ...xf("feature-store", "/:rest*", "/groups/:id/subscription"),

      // Account. XF's whole /account area is gone; the two below are the
      // long-lived deep links, and the catch-all is 307 so a future /account
      // route isn't blocked by a 308 browsers already cached.
      { source: "/account/droptracker", destination: "/settings", permanent: true },
      { source: "/account/premium", destination: "/settings", permanent: true },
      { source: "/account/:page*", destination: "/settings", permanent: false },

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
