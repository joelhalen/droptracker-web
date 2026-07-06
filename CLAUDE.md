# droptracker-web — Agent Reference

Auto-loaded orientation for the DropTracker frontend monorepo. The backend
(Python: intake API, Web API v1, Discord bots, workers) is a **separate repo**
deployed at `/store/droptracker/disc` on the production box.

## What Is This?

Next.js 15 (App Router, React 19) site + BFF for droptracker.io. The browser
only ever talks to Next.js; the BFF holds the session cookie and proxies to
the Python **Web API v1** (Quart, port 31325). pnpm + Turborepo monorepo.

```
apps/web              Next.js app: routes, components, lib, BFF /api routes
packages/api-types    Vendored openapi.json + generated TS types + Zod schemas
packages/config       Shared tsconfig / eslint presets
infra/                Dockerfile.web, dev-server.sh, topology notes
docs/                 events-prd.md + backend-tasks/ (specs for the backend repo)
```

## Route Groups (apps/web/app)

- `(public)` — `/`, `/leaderboards`, `/events[/id]`, `/announcements[/id]`,
  `/search`, `/docs[/slug]` (DB-backed CMS), `/groups/[id][/lootboard]`,
  `/players/[id]`, `/premium`
- `(dashboard)` — authed: `/dashboard`, `/settings`, `/submit`
  (guard: `requireUser()` in layout)
- `(admin)` — group admin `/groups/[id]/{settings,members,announcements,events,subscription,diagnostics}`
  + `/groups/new` wizard (guard: `canAdminGroup()`), and superadmin `/admin/*`
  (overview, events, groups, users, audit, data, logs, announcements, docs,
  discord, services, lookup, tiers, badges; guard: `requireSuperadmin()`)
- `app/api/*` — BFF routes: `auth/login`, `auth/callback`, `auth/logout`,
  `me`, `stream` (SSE proxy), `feed/recent`

## Key Modules

| Path | Purpose |
|---|---|
| `apps/web/lib/api.ts` | The BFF client — 100+ `api.*()` methods, forwards `dt_session` cookie, Zod-parses responses, mock fallback |
| `apps/web/lib/env.ts` | All server-side env reads |
| `apps/web/lib/session.ts` | OAuth state HMAC + session cookie set/clear |
| `apps/web/lib/auth.ts` | `getUser`/`requireUser`/`requireSuperadmin`/`canAdminGroup` |
| `apps/web/lib/use-event-stream.ts` | SSE client hook (reconnect + Zod validation) |
| `apps/web/lib/mock-data.ts` | Mock payloads (contract-tested), powers `USE_MOCK_API=true` |
| `apps/web/components/ui.tsx` | Design-system primitives (`Card`, `EmptyState`, `StatTile`, …) |
| `apps/web/components/config-editor.tsx` | Typed group-config form driven by the shared key registry |
| `apps/web/components/event-*.tsx` | Events v2 UI: create form, task form, bingo designer, manager, review queue, Discord config, join panel, live board |
| `apps/web/components/admin/` | Superadmin panels (audit log, badges, data browser, docs CMS, users, logs) |
| `packages/api-types/src/` | Hand-authored Zod schemas + group-config/entitlements registries |

## Rules

1. **Browser → BFF only.** Never fetch `:31325` from client code; server-side
   `lib/api.ts` is the single door to the backend.
2. **Contract first.** `packages/api-types/openapi.json` is vendored from the
   backend repo (`web_api/openapi.json`) — no auto-sync. Contract change =
   copy file → `pnpm gen:api-types` → update Zod schemas →
   `apps/web/test/contract.test.ts` must pass.
3. **Zod-validate every backend response** at the BFF boundary.
4. **Auth guards in layouts**, roles come from `api.me()`; superadmin implies
   owner on every group.
5. **Realtime = SSE** via `/api/stream` proxy; scopes: `global`, `feed`,
   `group:{id}`, `player:{id}`, `event:{id}`.
6. **Docs content lives in the DB** (superadmin CMS `/admin/docs`), not the repo.

## Commands

```bash
pnpm install && pnpm gen:api-types   # gen is REQUIRED before typecheck/build
pnpm dev          # :3000, mock mode by default (USE_MOCK_API=true)
pnpm lint && pnpm typecheck && pnpm test && pnpm build   # what CI runs
```

## Production

systemd `droptracker-node.service` (unit vendored in backend repo
`deploy/systemd/`): `next start`, `PORT=31380`, cwd `apps/web`,
`apps/web/.env.local → ../../.env` symlink. Deploy = `pnpm gen:api-types &&
pnpm build && sudo systemctl restart droptracker-node`. Fronted by Cloudflare;
`SESSION_COOKIE_SECURE=false` is REQUIRED while the origin is plain HTTP
(Secure cookies get dropped → infinite sign-in loop).

## Gotchas

- Fresh clone: `pnpm typecheck` fails until `pnpm gen:api-types` runs
  (generated types are gitignored).
- Mock sign-in: with `USE_MOCK_API=true` and no Discord app configured,
  the login route sets `dt_session=mock-session` — that's expected.
- Tests are Node's built-in `node:test` via `tsx` — no Jest/Vitest.
- The group-config editor is registry-driven — new config keys are added in
  `packages/api-types` (schema) + the backend registry, not hardcoded in the form.
