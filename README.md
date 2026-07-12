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

Requirements: **Node 20+** and **pnpm 10** (`corepack enable` gives you the
pinned version from `package.json#packageManager`).

```bash
pnpm install
cp .env.example apps/web/.env.local   # fill in Discord OAuth etc. (optional for mock mode)
pnpm gen:api-types                     # OpenAPI -> TS types
pnpm dev                               # http://localhost:3000
```

With `USE_MOCK_API=true` (the default in development) the app serves built-in
mock data and a synthetic live SSE stream, so it is fully runnable **without a
backend** — including a mock "Sign in with Discord". To develop against the
real backend instead, set `USE_MOCK_API=false` and point
`WEB_API_INTERNAL_URL` at a running Web API (`:31325` in production).

> Development workflow, testing, and the OpenAPI sync process are covered in
> [CONTRIBUTING.md](./CONTRIBUTING.md). Production deployment (systemd on the
> DropTracker box) is in [DEPLOY.md](./DEPLOY.md).

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run the Next.js app in dev mode |
| `pnpm build` | Production build (Turborepo) |
| `pnpm lint` | ESLint across the workspace |
| `pnpm typecheck` | `tsc --noEmit` across packages |
| `pnpm test` | Unit + OpenAPI contract tests |
| `pnpm gen:api-types` | Regenerate TS types from `openapi.json` |

## Deploying

To deploy the web app on the production box, run **`scripts/deploy.sh`** from
the repo root: it does `pnpm install --frozen-lockfile` → `pnpm gen:api-types`
→ `pnpm build` → an **immediate** `sudo systemctl restart droptracker-node`
(the restart must directly follow the build — a stale server writing ISR output
into a fresh `.next` has caused a ChunkLoadError outage) → polls
`127.0.0.1:31380` until it returns 200 → PASS/FAIL summary. Flags:
`--skip-install`, `--dry-run`. Assumes the invoking user can `sudo systemctl`.
The backend has its own script: `deploy/deploy.sh` in the backend repo
(`/store/droptracker/disc`). Full deployment notes: [DEPLOY.md](./DEPLOY.md).

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
- **Site admin (superadmin):** gated `/admin` shell — overview/health tiles,
  global announcements, Discord message sender, backend service management
  (start/stop/restart + logs), cross-content lookup, user moderation
  (grant/revoke superadmin), audit log, whitelisted data browser/editor,
  docs CMS, badge management, global events review, and subscription-tier
  CRUD. (The SQL executor is deliberately not ported.)
- **XenForo cutover:** expanded 301 redirect map from legacy URLs (§14.2).
- **Native lootboards (§12):** React-rendered interactive lootboard
  (`/groups/{id}/lootboard`) — value-tiered tiles, hover for qty/value, period
  switcher — with the legacy PNG generator kept as a "Download image" share.
- **Events v2 (Phase 6 — shipped 2026-07):** public events listing + detail
  (typed tasks, team leaderboard, live SSE-synced bingo board), join/team
  formation modes, and full group-admin management — event creation, typed
  task editor with item/NPC autocomplete, **bingo board designer**, lifecycle
  controls (draft → active → past), verification queue (approve/reject/award),
  per-event submission policy (all / confirm non-plugin / plugin-only),
  and per-event Discord guild/channel configuration. Backend engine lives in
  the backend repo (`services/event_engine.py` + `droptracker-events` worker).
- **Badges:** player-profile badge display plus superadmin badge CRUD and
  award/revoke at `/admin/badges`.
- **Live drop ticker:** site-wide `feed` realtime scope rendered by
  `components/live-drop-ticker.tsx`, hydrated from `/api/feed/recent`.
- **Documentation:** docs are **DB-backed** via the superadmin CMS
  (`/admin/docs`) and fetched at `/docs` through `api.docs()`/`api.doc(slug)`
  with a category sidebar. (This replaced the original static-MDX approach;
  the old `content/docs/*.mdx` files were removed — their content lives in
  the database now.)

Everything runs today on built-in mock data (`USE_MOCK_API`) so the UI is
demonstrable before the backend exists — including a dev mock sign-in.

### Backend dependencies

The authed/live features depend on the **Web API v1**, which lives in the
**backend repo**. Implementation specs for that repo's agent are in
[`docs/backend-tasks/`](./docs/backend-tasks/README.md) — one self-contained
`.md` per unit of work (API skeleton, OAuth/sessions, settings, leaderboards,
group-config, manual submission, realtime/Redis keys, migrations).

### Adding a doc

Sign in as a superadmin and use the docs CMS at `/admin/docs` (create, edit,
delete; set `title`, `category`, `order`). Pages are stored in the backend
database and appear automatically in the `/docs` sidebar, index, and sitemap.

### Still to come

Event extras from the PRD's later phases (effects/cooldowns/shop, board-race
mode, plugin-side event UI) and the final cutover (domain switch + sitemap of
dynamic player/group entities, Phase 5).
