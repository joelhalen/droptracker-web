# Contributing to droptracker-web

This is the Next.js frontend + BFF for [DropTracker](https://www.droptracker.io).
Read the [README](./README.md) for the architecture picture first; the deep
design rationale lives in [FRONTEND_PLAN.md](./FRONTEND_PLAN.md), and the
events system design in [docs/events-prd.md](./docs/events-prd.md).

## Setup

Node 20+ and pnpm 10 (`corepack enable` picks up the pinned version).

```bash
pnpm install
cp .env.example apps/web/.env.local
pnpm gen:api-types   # required once before typecheck/build — generated types are gitignored
pnpm dev             # http://localhost:3000
```

Two ways to develop:

- **Mock mode** (`USE_MOCK_API=true`, the dev default) — no backend needed.
  Every page works, including a mock Discord sign-in that unlocks the
  dashboard, group admin, and `/admin`. Mock payloads live in
  `apps/web/lib/mock-data.ts` and are contract-tested against the shared Zod
  schemas, so they can't silently drift from the API.
- **Live mode** (`USE_MOCK_API=false`) — point `WEB_API_INTERNAL_URL` at a
  running Web API v1 (the Python backend repo, port 31325) and configure real
  Discord OAuth credentials.

## Checks

```bash
pnpm lint        # ESLint (flat config from packages/config)
pnpm typecheck   # tsc --noEmit across the workspace
pnpm test        # node:test — includes the OpenAPI contract test
pnpm build       # production build (Turborepo)
pnpm format      # prettier
```

CI (`.github/workflows/ci.yml`) runs gen → lint → typecheck → test → build on
every push to `main` and every PR. Keep all four green.

## The API contract (please read before touching data fetching)

`packages/api-types/openapi.json` is the **vendored contract** with the Python
Web API — the backend repo holds the master copy at `web_api/openapi.json`.
There is no automatic sync: when the backend contract changes, copy the file
over, run `pnpm gen:api-types`, and update the hand-authored Zod schemas in
`packages/api-types/src/` to match. The contract test in
`apps/web/test/contract.test.ts` verifies that every BFF call maps to a spec
path and that mock data satisfies the schemas — it is the tripwire for drift.

## Conventions

- **The browser never talks to the Web API directly.** All data flows through
  the BFF: Server Components and Server Actions call `apps/web/lib/api.ts`,
  which forwards the `dt_session` cookie server-side. Client Components go
  through Server Actions or the `/api/*` BFF routes. Don't add client-side
  fetches to `:31325`.
- **Validate at the boundary.** Everything returned from the backend is parsed
  through the shared Zod schemas before it reaches a component.
- **Server Components by default**; add `"use client"` only where there's
  interactivity. Public pages use ISR (`revalidate`), authed pages are
  `force-dynamic`.
- **Auth guards live in `apps/web/lib/auth.ts`** (`requireUser`,
  `requireSuperadmin`, `canAdminGroup`) — call them in layouts/pages, never
  re-derive roles in components.
- **Realtime is SSE, not WebSockets** — subscribe with
  `useEventStream(channels, onEvent)` (`apps/web/lib/use-event-stream.ts`),
  which handles reconnect/backoff and Zod-validates events.
- **Design system:** use the primitives in `apps/web/components/ui.tsx`
  (`Card`, `EmptyState`, `StatTile`, …) and Tailwind 4; match existing
  patterns rather than introducing new UI vocabulary.
- **Docs content is data, not code** — it's managed in the superadmin CMS at
  `/admin/docs`, not in the repo.

## Gotchas

- `pnpm typecheck` fails on a fresh clone until you run `pnpm gen:api-types`
  (the generated types are gitignored by design).
- `SESSION_COOKIE_SECURE` must stay `false` on any plain-HTTP origin
  (including Cloudflare Flexible SSL) or sign-in loops forever — the browser
  silently discards Secure cookies over HTTP.
- The production box symlinks `apps/web/.env.local → ../../.env`; see
  [DEPLOY.md](./DEPLOY.md) for how the live site is built and restarted.

## Questions?

Open a GitHub issue or ask in the DropTracker Discord.
