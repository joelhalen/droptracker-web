# droptracker-web

First-party web platform for the [DropTracker](https://www.droptracker.io)
system — a Next.js front-end that replaces the legacy XenForo + PHP-addon shell
with live leaderboards, Discord-native auth, group administration, and a
lightweight announcements system.

> Full design: [`FRONTEND_PLAN.md`](./FRONTEND_PLAN.md).

## Architecture (at a glance)

```
Browser ──▶ Next.js (App Router) = BFF ──▶ Web API v1 (Python/Quart, backend repo)
            • Discord OAuth + session cookie        • reads MySQL + Redis
            • SSR/ISR public pages                  • SSE ← Redis pub/sub
            • SSE proxy, never exposes backend token
```

The browser only ever talks to the Next.js server (the BFF), which holds secrets
and the session. The Web API v1 is a **separate** service from the RuneLite
intake API. This repo consumes the API's OpenAPI contract
(`packages/api-types/openapi.json`) — the single source of truth for types.

## Monorepo layout

```
apps/
  web/                 Next.js 15 app (App Router) — BFF + UI
packages/
  api-types/           OpenAPI v1 contract + generated TS types + shared Zod schemas
  config/              shared tsconfig / eslint presets
infra/                 Dockerfile + deployment notes
```

## Getting started

```bash
pnpm install
cp .env.example apps/web/.env.local   # fill in Discord OAuth etc. (optional for mock mode)
pnpm gen:api-types                     # OpenAPI -> TS types
pnpm dev                               # http://localhost:3000
```

With `USE_MOCK_API=true` (the default in development) the app serves built-in
mock data and a synthetic live SSE stream, so it is fully runnable **before** the
Web API v1 exists.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run the Next.js app in dev mode |
| `pnpm build` | Production build (Turborepo) |
| `pnpm lint` | ESLint across the workspace |
| `pnpm typecheck` | `tsc --noEmit` across packages |
| `pnpm test` | Unit + OpenAPI contract tests |
| `pnpm gen:api-types` | Regenerate TS types from `openapi.json` |

## Status

Built so far (FRONTEND_PLAN.md §17):

- **Phase 1 — public read site:** OSRS-themed shell; global leaderboard home,
  `/leaderboards` (player/group tabs, day/week/month/all-time periods),
  player/group profiles, announcements list + detail, and `/search`. SSR/ISR with
  an SSE hook wired into live leaderboard updates.
- **Phase 2 — identity & dashboard:** BFF Discord OAuth + httpOnly session,
  auth-aware nav, gated `(dashboard)` route group — my accounts, `/settings`
  (notification/privacy/DM + Patreon/premium prefs), and `/submit` (manual
  submission). Server Actions for writes.
- **Phase 3 — group admin:** gated `(admin)/groups/{id}` shell with an admin hub
  and tabs — typed config editor (built on the shared 55+ key **registry**, §11.1),
  members management (WOM sync + hide/unhide players), and a diagnostics panel.
  Plus the multi-step **group-creation wizard** (`/groups/new`: WOM lookup → guild
  status → create).
- **Phase 4 — announcements:** group announcements composer (Markdown + preview,
  pin, "also post to Discord") wired to the public announcements feed/pages.
- **Group subscriptions (upgrades):** per-group recurring subscription management
  (current plan, tiers, subscribe/switch/cancel/resume, billing portal) and a
  public `/premium` pricing page. Replaces the points-based feature store, which
  is out of scope.
- **Site admin (superadmin):** gated `/admin` shell — global announcements,
  Discord message sender, backend service management (start/stop/restart + logs),
  cross-content lookup, and subscription-tier CRUD. (The SQL executor is
  deliberately not ported.)
- **XenForo cutover:** expanded 301 redirect map from legacy URLs (§14.2).

Everything runs today on built-in mock data (`USE_MOCK_API`) so the UI is
demonstrable before the backend exists — including a dev mock sign-in.

### Backend dependencies

The authed/live features depend on the **Web API v1**, which lives in the
**backend repo**. Implementation specs for that repo's agent are in
[`docs/backend-tasks/`](./docs/backend-tasks/README.md) — one self-contained
`.md` per unit of work (API skeleton, OAuth/sessions, settings, leaderboards,
group-config, manual submission, realtime/Redis keys, migrations).

### Still to come

Native React lootboards (§12), the events system (Phase 6), documentation/MDX
(§19), and final cutover (domain switch + sitemap of dynamic entities, Phase 5).
