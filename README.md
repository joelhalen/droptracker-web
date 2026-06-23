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

Phase 0/1 scaffold (FRONTEND_PLAN.md §17): monorepo, OSRS-themed design shell,
public global leaderboard + player/group/announcement pages (SSR/ISR), the BFF
Discord OAuth + session flow, an SSE hook wired into live leaderboard updates,
and CI (lint · typecheck · test · build). Subsequent phases add identity
dashboards, group admin, announcements CRUD, and XenForo cutover.
