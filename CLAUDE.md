# droptracker-web — Agent Reference

Auto-loaded orientation for the DropTracker frontend monorepo. The backend
(Python: intake API, Web API v1, Discord bots, workers) is a **separate repo**
deployed at `/store/droptracker/disc` on the production box. Active branch here
is `main` (the backend repo's is `new-api`).

## What Is This?

Next.js 15 (App Router, React 19) + BFF for droptracker.io. The browser only
ever talks to Next.js; the BFF holds the session and proxies to the Python
**Web API v1** (Quart, port 31325). pnpm + Turborepo monorepo, Tailwind v4.

This repo serves **three** front-ends off one Next.js process:

| Surface | Entry | Notes |
|---|---|---|
| The site | `app/(site)/` | Public + dashboard + admin. Session lives in the `dt_session` cookie. |
| Discord Activity | `app/activity/` | Embedded App SDK iframe on `<app-id>.discordsays.com`. Chromeless, **cookie-less** (see Rules). |
| Board image export | `app/board-image/[id]/` | Chromeless board render the backend screenshots for Discord; gated by `BOARD_IMAGE_TOKEN`. |

```
apps/web              Next.js app: routes, components, lib, BFF /api routes, middleware
packages/api-types    Vendored openapi.json + generated TS types + hand-authored Zod schemas
packages/config       Shared tsconfig / eslint presets
infra/                Dockerfile.web, dev-server.sh, topology notes
docs/                 events-prd.md, loot-sweep-frontend.md, backend-tasks/ (specs for the backend repo)
scripts/deploy.sh     Blue-green production deploy
```

## Routes

**Everything user-facing is nested under the `(site)` route group** —
`app/(site)/(public)`, `app/(site)/(dashboard)`, `app/(site)/(admin)`. The
`(site)` layout owns the header, live ticker, and footer; `app/activity` and
`app/board-image` deliberately sit outside it so they render chromeless.

- `(public)` — `/`, `/leaderboards`, `/events/[id]{,/players,/teams[/teamId]}`,
  `/announcements[/id]`, `/search`, `/docs[/slug]` (DB-backed CMS),
  `/groups/[id]{,/lootboard,/personal-bests,/points[/leaderboard]}`,
  `/players/[id]`, `/npcs/[npcId]`, `/items/[itemId]`, `/item-values`,
  `/personal-bests`, `/suggestions[/new|/id]`, `/premium`
- `(dashboard)` — authed: `/dashboard`, `/settings`, `/submit`, `/register`,
  `/tickets[/id]` (guard: `requireUser()` in the layout)
- `/file-transfer` (web95a) — authed but **unlisted**: any signed-in user may
  send staff a file (25 MB, any type, kept 30 days). Sits directly under
  `(site)`, NOT in `(dashboard)`, because that layout's
  `requireUser("/dashboard")` runs before a nested page's guard and would bounce
  a signed-out visitor to the dashboard instead of back to the link they were
  given. Staff side: `/admin/file-transfers`.
- `(admin)` — group admin under `/groups/[id]/…` (`settings`, `members`,
  `admin`, `authorized`, `announcements`, `events[/eventId[/discord]]`,
  `event-managers`, `embeds`, `points[/manage]`, `submissions`, `subscription`,
  `diagnostics`, `events/invitations/[eventId]` — the clan-vs-clan challenge
  view a Discord DM links to: accept/decline plus a live thread with the
  challenger) + `/groups/new` wizard; and the staff `/admin/*` shell
  (web87a: developers see the diagnostic subset — audit, data (read-only),
  logs, lookup, file-transfers, services status, status, projects, task-library,
  item-values, personal-bests — while superadmins additionally get events, event-limits,
  event-types, groups, users, announcements, docs, discord, tiers, badges,
  backups, b2, subscriptions, tickets, redirects, boardgame-shop, plus
  service control and data editing)
- `app/middleware.ts` — Edge middleware resolving **DB-backed redirects** ahead
  of routing, via the cached `/api/redirects` handler (it cannot import
  `lib/api` or touch the DB). Static legacy 301s in `next.config.ts` are the
  fallback layer; a DB rule shadows them.
- `next.config.ts` rewrites — `/` on host `activity.droptracker.io` → `/activity`;
  `/payment_callback.php` → the backend's legacy PayPal IPN; the Stripe billing
  webhook proxied raw (web_api is internal-only, so its public path must live here).

## BFF Routes (`app/api/*`)

- Site: `auth/{login,callback,logout}`, `me`, `stream` (SSE proxy),
  `feed/recent`, `search`, `health`, `redirects`, `uploads/proof`,
  `file-transfers[/[id]/versions/[version]/download]`,
  `admin/file-transfers/[id]/versions`,
  `players/[id]/{card,loot}`, `groups/[id]/card`,
  `events/[id]/{completions/history,players/[playerId],tasks/[taskId]/breakdown}`
- Activity: `api/activity/*` — a parallel BFF surface (~45 handlers) covering
  `auth`, `me`, `claim`, `events/*` (board, board game roll/shop/items, buyins,
  completions, join/leave, loot-sweep, players, pot, teams), `group-setup/*`,
  `leaderboards`, `pbs`, `feed`, `search`, `stream`, `launch-intent`.

## Key Modules

| Path | Purpose |
|---|---|
| `apps/web/lib/api/` | The BFF client — ~350 `api.*()` methods split across per-domain modules (`events.ts`, `groups.ts`, `admin.ts`, …). `index.ts` re-assembles the single `api` object, so importers keep using `@/lib/api`. Shared plumbing in `_client.ts` (`apiGet`/`apiSend`/`apiSendForm`/`withFallback` + `ApiError`), hand-authored types in `types.ts`. Forwards the `dt_session` cookie, Zod-parses responses, mock fallback. **Add a method to its domain module, not to `index.ts`** |
| `apps/web/lib/env.ts` | All server-side env reads (documented inline — read it before adding a var) |
| `apps/web/lib/session.ts` | OAuth state HMAC + session cookie set/clear; exports `SESSION_COOKIE` |
| `apps/web/lib/auth.ts` | `getUser`/`requireUser`/`requireSuperadmin`/`requireDeveloper`/`requireGroupAdminPage` + pure `groupRole`/`canAdminGroup`/`canManageEvents` |
| `apps/web/lib/activity/` | Activity-only client: `discord-sdk.ts`, `auth-context.tsx`, `data-context.tsx`, `api.ts` (client-side, Zod-parsed), `nav.tsx` |
| `apps/web/lib/use-event-stream.ts` | SSE client hook (reconnect + Zod validation) |
| `apps/web/lib/events.ts`, `loot-sweep*.ts` | Pure event/board shaping logic — unit-tested, keep logic here not in components |
| `apps/web/lib/chat.ts` | Pure chat shaping — message sides (by PARTY, not author), system-entry wording, id-keyed merge, day/block grouping. Unit-tested; keep it out of the components |
| `apps/web/lib/mock-data.ts` | Mock payloads (contract-tested), powers `USE_MOCK_API=true` |
| `apps/web/components/ui.tsx` | Design-system primitives (`Card`, `EmptyState`, `StatTile`, …) |
| `apps/web/components/config-editor.tsx` | Typed group-config form driven by the shared key registry |
| `apps/web/components/event-*.tsx` | Events v2 UI: create/wizard, task form, bingo designer, board designer, manager, review queue, Discord config, layouts, sign-up tools, live board |
| `apps/web/components/loot-sweep-*.tsx` | Loot-sweep matrix board, standings, receipt cards, editor |
| `apps/web/components/chat/` | Generic live thread panel + message row (web96a). Props are a thread and its first page — no event-specific logic, so the next surface mounts it unchanged. Server actions live in `app/(site)/chat-actions.ts` |
| `apps/web/components/activity/`, `components/setup/` | Activity views; shared group-setup + RSN-claim flows (site and activity) |
| `apps/web/components/admin/` | Superadmin panels (audit, badges, data browser, docs CMS, users, logs, tickets, backups, …) |
| `packages/api-types/src/` | Hand-authored Zod schemas + group-config/entitlements/tier-flair registries |

## Rules

1. **Browser → BFF only.** Never fetch `:31325` from client code; server-side
   `lib/api/` is the single door to the backend. The Activity follows the same
   rule via same-origin `/api/activity/*` (also required by its CSP).
2. **The Activity has no cookies.** Cookies do not survive the
   `discordsays.com` iframe, so `/api/activity/auth` returns the session in the
   **response body** and `lib/activity/auth-context.tsx` holds it. Never assume
   `cookies()` works on an activity path.
3. **Contract first.** `packages/api-types/openapi.json` is vendored from the
   backend repo (`web_api/openapi.json`) — no auto-sync. Contract change =
   copy file → `pnpm gen:api-types` → update Zod schemas →
   `apps/web/test/contract.test.ts` must pass.
4. **Zod-validate every backend response** at the BFF boundary.
5. **Auth guards live in layouts**, roles come from `api.me()`; superadmin
   implies owner on every group. There is no shared `(admin)` layout — each
   subtree guards itself: `admin/layout.tsx` → `requireSuperadmin`,
   `moderation/layout.tsx` → `requireModerator`, `groups/[id]/layout.tsx` →
   `requireUser` + `canAdminGroup`/`canManageEvents`. A new admin subtree needs
   its own guard. Role failures use the `unauthorized()` / `forbidden()`
   interrupts (real 401/403 pages), not silent redirects.
6. **Realtime = SSE** via `/api/stream` proxy; scopes: `global`, `feed`,
   `group:{id}`, `player:{id}`, `event:{id}`, `chat:{id}`, `user:{id}`. The last
   two are web96a: `chat:` carries message bodies and the Web API gates it on
   thread membership; `user:` carries badge hints and is identity-checked.
   `useEventStream` already shares and refcounts one `EventSource` per channel
   set — never open your own.
7. **Docs content lives in the DB** (superadmin CMS `/admin/docs`), not the repo.
8. **`next build` does not lint.** `eslint: { ignoreDuringBuilds: true }` is
   deliberate — `next build`'s own ESLint pass diverges from `eslint .` and used
   to turn green CI into red deploys. `pnpm lint` is the single source of truth.

## Commands

```bash
pnpm install && pnpm gen:api-types   # gen is REQUIRED before typecheck/build
pnpm lint && pnpm typecheck && pnpm test && pnpm build   # what CI runs (Node 22, pnpm 10.33.0)
```

Dev server — **read the mock-mode gotcha below before using `pnpm dev`**:

```bash
USE_MOCK_API=true PORT=3001 pnpm dev
```

## Production

Zero-downtime **blue-green**: `droptracker-node-blue.service` (:31380,
`.next-blue`) and `droptracker-node-green.service` (:31381, `.next-green`) both
run continuously behind nginx; `droptracker-node` is a **oneshot deploy
trigger, not a server**. Deploy with `scripts/deploy.sh` (or
`sudo systemctl restart droptracker-node`, which runs it); re-run to roll back.

**Never `pnpm build && systemctl restart`** — a bare `pnpm build` writes `.next`,
which neither instance serves, and it reintroduces the in-place-`.next`
ChunkLoadError outage. Never restart blue and green together (that is downtime).

Full detail — nginx upstream file, health check, rollback, Cloudflare and the
`SESSION_COOKIE_SECURE=false` requirement — lives in [DEPLOY.md](DEPLOY.md).
Keep deploy facts there; this section is a pointer, not a second copy.

## Gotchas

- **`pnpm dev` is NOT mock mode on this box.** `USE_MOCK_API` defaults to true
  outside production, *but* `apps/web/.env.local` is a symlink to the repo-root
  `.env`, which sets `USE_MOCK_API=false` and points at the live backend on
  `:31325`. A plain `pnpm dev` therefore hits production data and cannot see
  undeployed backend changes. Pass `USE_MOCK_API=true` explicitly for mocks; to
  smoke-test what is actually deployed, curl `:31380` directly.
- Fresh clone: `pnpm typecheck` fails until `pnpm gen:api-types` runs
  (generated types are gitignored).
- Mock sign-in: with `USE_MOCK_API=true` and no Discord app configured, the
  login route sets `dt_session=mock-session` — that's expected.
- Tests are Node's built-in `node:test` via `tsx` — no Jest/Vitest.
- The group-config editor is registry-driven — new config keys are added in
  `packages/api-types` (schema) + the backend registry, not hardcoded in the form.
- Soft-404s render as HTTP 200 with the not-found page, so status codes alone
  aren't a reliable page-exists check when curling.
- This box often carries the owner's in-flight edits. Diff before committing.
