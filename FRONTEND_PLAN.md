# DropTracker — New Front-End Platform Plan

> **Status:** Proposal / blueprint for a **fresh repository** (`droptracker-web`).
> Nothing in this document is meant to be merged into the backend repo. It is a
> complete picture of *what to build*, *how it integrates with the existing
> Python/Quart backend*, and *in what order*.

**Decisions locked in (from stakeholder):**

| Decision | Choice |
|---|---|
| Scope | **Replace XenForo entirely.** No full forum — only a lightweight *announcements / update-thread* system that auto-syndicates posts to Discord. |
| Front-end stack | **Next.js (App Router) + React + TypeScript** |
| Authentication | **Discord OAuth as the primary identity**, backend issues its own session/JWT |
| Backend integration | **New dedicated, versioned web API + a Backend-for-Frontend (BFF) layer** (separate from the RuneLite intake API) |

---

## Table of Contents

1. [Goals & Non-Goals](#1-goals--non-goals)
2. [Current-State Analysis](#2-current-state-analysis)
3. [Target Architecture](#3-target-architecture)
4. [Technology Stack & Rationale](#4-technology-stack--rationale)
5. [New Repository Layout](#5-new-repository-layout)
6. [The Web API (v1) — Contract & Surface](#6-the-web-api-v1--contract--surface)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Real-Time Data Architecture](#8-real-time-data-architecture)
9. [Feature & Page Inventory](#9-feature--page-inventory)
10. [Announcements → Discord Syndication](#10-announcements--discord-syndication)
11. [Group Configuration Management UI](#11-group-configuration-management-ui)
12. [Lootboards & Media](#12-lootboards--media)
13. [Data Model Additions Required](#13-data-model-additions-required)
14. [XenForo Decommission & Migration](#14-xenforo-decommission--migration)
15. [Non-Functional Requirements](#15-non-functional-requirements)
16. [Infrastructure, Deployment & CI/CD](#16-infrastructure-deployment--cicd)
17. [Phased Roadmap](#17-phased-roadmap)
18. [Risks & Mitigations](#18-risks--mitigations)
19. [Open Questions / Decisions Log](#19-open-questions--decisions-log)
20. [Appendices](#20-appendices)

---

## 1. Goals & Non-Goals

### Goals
- A first-party web platform that **owns identity, presentation, configuration, and announcements**, eliminating the XenForo + PHP-addon indirection.
- **Real-time** leaderboards, group dashboards, and live drop feeds, driven by the data the backend already maintains in Redis and MySQL.
- A **clean, versioned contract** between web and backend so the front-end is no longer coupled to ad-hoc endpoints that were grown for the PHP site.
- **Discord-native onboarding**: sign in with Discord, link OSRS accounts, manage groups you own/administer.
- A **self-service group admin** experience that replaces every configuration action currently buried in Discord slash commands or XenForo pages.
- A lightweight **announcements** system (per-group and global) that auto-posts to Discord — the only "forum-like" feature we keep.
- **No regressions** in the RuneLite submission pipeline. The intake API (`/webhook`) is untouched by this project.

### Non-Goals (for the initial build)
- A full discussion forum (threads, replies, moderation, reactions). Out of scope; announcements only.
- Re-architecting the RuneLite intake or the Discord bot processes.
- Migrating historical XenForo *forum* content (there is no forum to preserve going forward).
- Replacing the lootboard **image** generator. We will surface live data natively and keep generated images as an optional/legacy artifact.

---

## 2. Current-State Analysis

### 2.1 How the system is wired today

```
RuneLite plugin ──▶ Quart API (port 31323)  ──▶ MySQL (data + xenforo) + Redis
                         │                              ▲
                         │ writes notification_queue    │ reads
                         ▼                              │
                  Discord bot(s) ───────────────────────┘
                         ▲
   Browser ──▶ XenForo (PHP) ──(XF_KEY, server-to-server)──▶ Quart API
                         │
                         └─ owns: login/sessions, forum, user profiles,
                                  group pages, config pages, board generator UI
```

The **XenForo site + the `DropTrackerXFAddons` PHP addons** are effectively a
presentation/auth shell. They authenticate the browser, then make
server-to-server calls into the Python API using the shared `XF_KEY` secret. The
API already contains a surprising amount of "website" logic, with endpoints and
comments that explicitly reference the PHP front-end.

### 2.2 What the backend already exposes for the website

Confirmed from `api/routes/`:

| Endpoint | Purpose | Notes for new front-end |
|---|---|---|
| `GET /top_players` | Global monthly leaderboard (top 5) | Reads Redis sorted set; 20s in-proc cache. Will need pagination/limit params. |
| `GET /player_search?name=` | Rich player profile (loot, rank, top NPC, groups, recent submissions, points) | Already a "profile" payload. Good basis for `/api/v1/players/{id}`. |
| `GET /player?player_name=` | Raw `Player.to_dict()` | Rate-limited 5/10s. |
| `GET /load_config?player_name=&acc_hash=` | Per-group notify config for a player (plugin-facing) | Drives the RuneLite settings panel. |
| `GET /top_groups` | Group leaderboard by monthly loot | Recomputes per request over all groups — **expensive**, needs rework. |
| `GET /group_search?name=` | Group profile (members, rank, top player, recent submissions, stats) | Basis for `/api/v1/groups/{id}`. |
| `POST /groups/create` | Web group-creation wizard (XF_KEY auth) | Logic in `db.group_creation.create_web_group`; 1:1 with `/create-group` Discord cmd. |
| `GET /groups/guild-status/{guild_id}` | Is bot present / does guild own a group | Wizard step. |
| `GET /groups/wom-lookup/{wom_id}` | WOM group preview + already-registered check | Wizard step. |
| `POST /groups/{id}/wom-sync` | On-demand WOM membership sync (per-group `export_api_key` auth) | "Sync" button. |
| `GET /groups/custom_board/{id}` / `board_update/{id}` | Generate / refresh lootboard image | Subprocess to `board_cli.py`. |
| `POST /generate-timeframe-board` | Scoped lootboard image (timeframe/NPC) | Subprocess; returns public image URL. |
| `GET /groups/admin_diagnostics/{id}` | Pipeline heartbeat + activity for a group | Powers an admin "is it working" panel. |
| `POST /manual-submit` | Web-originated submission (drop/clog/pb/ca/pet) | Auth handled by the front-end today. |
| `GET /presigned_upload_url`, `POST /video/upload-complete` | Video upload flow (B2) | Reusable. |
| `GET /ping`, `/health`, `/metrics` | Ops | Reusable. |

CORS is currently pinned to `https://www.droptracker.io` on the website-facing
routes (`@route_cors(allow_origin=...)`).

### 2.3 Identity model (important)

- **`users`** — Discord users: `discord_id`, `auth_token` (16-char), `xf_user_id` (XenForo link), ping/visibility flags.
- **`players`** — OSRS accounts: `player_name`, `wom_id`, `account_hash` (bound from plugin), `user_id` → users.
- **`groups`** — clans: `group_name`, `wom_id`, `guild_id`. **Group 2 is the global group** (everyone is a member); group ids ≤ 2 are reserved/system.
- **`user_group_association`** — M2M player ↔ group.
- **`group_configurations`** — key/value behavior per group.

**Key insight:** identity is *already Discord-centric*. `xf_user_id` is the only
hard dependency on XenForo for identity, which makes "Discord OAuth primary"
a natural fit — we replace the XenForo session with our own, keyed on
`discord_id`.

### 2.4 Real-time substrate that already exists

- Redis sorted sets per month partition (`YYYYMM`): global, per-group, per-NPC leaderboards, plus per-player total strings.
- Leaderboard mutations happen in `services/redis_updates.py` immediately after a drop is written.
- `notification_queue` is drained asynchronously by the Discord `NotificationService` (3s poll). This is the natural hook point to *also* fan out live web events.

> ⚠️ **Redis key-scheme inconsistency to resolve.** The codebase uses at least
> two group-leaderboard key shapes: `leaderboard:{partition}:group:{group_id}`
> (in `api/routes/groups.py`) vs. `leaderboard:group:{group_id}:{partition}`
> (docs / `Player.get_score_at_npc`). The new real-time layer must standardize
> on one canonical scheme (see §8) and the backend reads should be reconciled.

> ⚠️ **Time-partition granularity.** The PHP addon's leaderboard filters support
> **daily, weekly, monthly, and all-time** partitions, not just monthly. The
> backend Redis key scheme and API must support at least `YYYYMMDD` (daily) and
> `YYYYWW` (weekly) partitions in addition to `YYYYMM` to achieve parity.

### 2.5 Pain points the new platform must fix

1. **Two hops + a shared secret** (browser → XenForo PHP → Quart) for everything. Brittle and hard to evolve.
2. **No real-time** — the site polls or shows static/cached values and generated PNGs.
3. **Website logic leaking into the intake API** — the same Quart app serves RuneLite ingest *and* website reads, so website traffic competes with submission processing (already a known latency problem — see `docs/REFACTOR_PLAN.md`).
4. **Config UX is fragmented** across Discord slash commands, XenForo pages, and `load_config`.
5. **Auth is XenForo-owned**, so the web experience can't be improved without touching the forum platform.

---

## 3. Target Architecture

```
                         ┌────────────────────────────────────────────┐
                         │            Browser (Next.js SPA/SSR)         │
                         └───────────────┬──────────────────────────────┘
                                         │  HTTPS (cookies: httpOnly session)
                                         ▼
                    ┌──────────────────────────────────────────────┐
                    │     Next.js server (App Router) = BFF          │
                    │  • Route Handlers / Server Actions             │
                    │  • Holds Discord OAuth, sets session cookie    │
                    │  • Server-side data fetching + caching (ISR)   │
                    │  • Proxies/aggregates calls to Web API v1      │
                    └───────────────┬───────────────┬────────────────┘
                          REST/JSON │               │ SSE / WebSocket
                                    ▼               ▼
        ┌───────────────────────────────────┐  ┌──────────────────────────┐
        │  Web API v1  (NEW, Python/Quart    │  │ Realtime gateway          │
        │  blueprint or separate service)    │  │ (SSE/WS) ← Redis pub/sub  │
        │  • /api/v1/players, /groups, ...   │  └──────────────────────────┘
        │  • reads MySQL + Redis             │             ▲
        │  • writes config, announcements    │             │ publish events
        └───────────────┬────────────────────┘             │
                        │                                   │
                        ▼                                   │
        ┌───────────────────────────────────────────────────────────────┐
        │   MySQL (data)        Redis (leaderboards + pub/sub + cache)    │
        └───────────────────────────────────────────────────────────────┘
                        ▲
                        │ unchanged
        ┌───────────────┴───────────────┐     ┌──────────────────────────┐
        │ RuneLite intake API (31323)    │     │ Discord bot(s) + Notif.  │
        │  /webhook  (UNCHANGED)         │     │ NotificationService       │
        └────────────────────────────────┘     └──────────────────────────┘
```

### 3.1 Component responsibilities

- **Next.js server = BFF.** Owns the Discord OAuth dance, the session cookie, server-side rendering of public pages (SEO), and aggregation of multiple Web-API calls into page-shaped payloads. The browser never talks to the Web API directly — only to the Next.js server, which holds secrets and the session.
- **Web API v1.** A *new*, versioned, browser-oriented JSON API. Implemented as a **separate Quart app/process (recommended)** or, as an interim step, a new `/api/v1` blueprint in the existing app. Either way it is logically distinct from `/webhook` intake and can be scaled/deployed independently so website traffic never competes with submission processing.
- **Realtime gateway.** SSE (default) or WebSocket endpoint that subscribes to Redis pub/sub channels and streams events (new drops, leaderboard deltas, announcements) to connected clients.
- **Backend (existing).** MySQL + Redis + Discord bot stay as they are. We add: (a) Redis pub/sub *publishes* at the same points that already mutate leaderboards / drain the notification queue, and (b) a few new tables (announcements, web sessions/OAuth state, audit) and config write-paths.

### 3.2 Why a separate Web API instead of reusing the intake app

The intake API already suffers pool exhaustion under submission load
(`docs/REFACTOR_PLAN.md`). Adding browser traffic to the same process makes that
worse and couples two very different workloads (high-write, latency-sensitive
ingest vs. high-read, cacheable web). A separate process with its own DB pool,
its own rate limits, and its own deploy cadence is the correct long-term shape
and matches the "new dedicated API + BFF" decision.

---

## 4. Technology Stack & Rationale

### Front-end
- **Next.js 15 (App Router) + React 19 + TypeScript** — SSR/ISR for SEO on public leaderboards/profiles; Server Components for data-heavy pages; Route Handlers as the BFF.
- **Styling:** Tailwind CSS + a component layer (shadcn/ui or Radix primitives) for accessible, themeable components. OSRS-flavored theme tokens.
- **Data fetching/state:** TanStack Query (client islands that need polling/live refresh) layered over Server Components for first paint. Zustand for ephemeral UI state.
- **Charts:** Recharts or visx for loot-over-time, KC distributions, etc.
- **Realtime client:** native `EventSource` (SSE) wrapper, with a WS upgrade path if bi-directional needs appear.
- **Forms/validation:** React Hook Form + Zod (Zod schemas shared with API contract types).
- **Auth glue:** Auth.js (NextAuth) with the Discord provider, OR a thin custom OAuth handler if we want full control of session issuance against the backend. (Recommendation: Auth.js Discord provider for the OAuth dance, but persist/extend the session via our backend so `user_id`/group roles are authoritative.)

### Web API (new)
- **Python + Quart** to stay consistent with the existing codebase and reuse models/services (`db/models`, `services/redis_updates`, `db.group_creation`, etc.) without rewriting business logic in another language.
- **Pydantic** for request/response schemas + automatic OpenAPI generation.
- **SQLAlchemy 2.0** (already in use). Dedicated, smaller connection pool tuned for read-heavy web traffic.
- **OpenAPI spec** published and used to **generate the TypeScript client** consumed by the BFF (single source of truth for contracts).

### Shared
- **OpenAPI → TS types** (e.g. `openapi-typescript`) so the front-end and API never drift.
- **Redis** for pub/sub (realtime) and short-TTL response caching.

> If the team later prefers a Node/TS API for end-to-end type sharing, the BFF
> boundary makes that swap possible without touching the front-end. Starting in
> Python maximizes reuse of existing, battle-tested processing/identity logic.

---

## 5. New Repository Layout

A **pnpm + Turborepo monorepo** so the web app, the (optional) shared packages,
and the API contract live together and version in lockstep.

```
droptracker-web/
├── apps/
│   ├── web/                      # Next.js app (BFF + UI)
│   │   ├── app/                  # App Router routes
│   │   │   ├── (public)/         # leaderboards, group/player profiles, announcements
│   │   │   ├── (dashboard)/      # authed: my accounts, my groups
│   │   │   ├── (admin)/          # group admin: config, members, announcements
│   │   │   ├── api/              # Route Handlers = BFF (auth callback, SSE proxy)
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   ├── lib/                  # api client, auth, realtime hooks
│   │   └── styles/
│   └── api/                      # NEW Web API v1 (Python/Quart) — OR keep in backend repo*
│       ├── app.py
│       ├── v1/                   # players, groups, config, announcements, auth, realtime
│       ├── schemas/              # Pydantic
│       └── openapi.json          # generated
├── packages/
│   ├── api-types/                # openapi-typescript output, shared Zod schemas
│   ├── ui/                       # shared design-system components (optional)
│   └── config/                   # eslint/tsconfig/tailwind presets
├── infra/                        # Dockerfiles, compose, deploy manifests
├── .github/workflows/            # CI: lint, typecheck, test, build, deploy
├── turbo.json
└── pnpm-workspace.yaml
```

> \* **Placement decision for the Web API:** two viable options —
> **(A)** keep the new Web API *inside the backend repo* (as `web_api/` next to
> `api/`) so it can import `db/`, `services/`, `utils/` directly; the Next.js repo
> only consumes its OpenAPI. This is the **recommended** option because the API
> reuses existing models/services and avoids a code-sharing boundary across repos.
> **(B)** put a thin API in this monorepo and have it import the backend as a
> package. Option A is simpler operationally. Either way, the *front-end* lives in
> the fresh repo as requested. The plan below assumes **Option A** for the API
> with the contract (OpenAPI) vendored into `packages/api-types`.

---

## 6. The Web API (v1) — Contract & Surface

Principles: **versioned** (`/api/v1`), **resource-oriented**, **paginated**,
**cache-friendly** (ETag/`Cache-Control`), **typed** (OpenAPI), and **separate
auth** from the RuneLite intake. All write/admin routes require a session +
authorization check (see §7). Public read routes are anonymous + cached.

> **Note on parity with the PHP addon.** The routes below have been reconciled
> against the actual `DropTrackerXFAddons` codebase (170+ PHP files across
> `/Pages`, `/Admin`, `/Events`, `/Docs`, `/Upgrades`, `/Core`). Items marked
> **(PHP parity)** are features that existed in XenForo but were not in the
> original draft of this plan.

### 6.1 Public reads
```
GET /api/v1/leaderboards/players?period=YYYYMM|YYYYWW|YYYYMMDD|all&scope=global|group:{id}|npc:{id}&page=&limit=
GET /api/v1/leaderboards/groups?period=...&page=&limit=
GET /api/v1/leaderboards/points?period=YYYYMM&scope=global|group:{id}&page=&limit=   # (PHP parity: top point-earners leaderboard)
GET /api/v1/players/{playerId}                  # profile (loot, rank, top NPC, groups, points)
GET /api/v1/players/{playerId}/submissions?type=&cursor=
GET /api/v1/players/{playerId}/drops            # NPC-organised loot table  (PHP parity)
GET /api/v1/players/{playerId}/points           # point credit/debit history  (PHP parity)
GET /api/v1/players/{playerId}/ranks?npc=&group=&period=   # top-ranks per context  (PHP parity)
GET /api/v1/players/search?q=
GET /api/v1/players/highlighted                 # weighted-random featured players  (PHP parity)
GET /api/v1/groups/{groupId}                    # profile + stats
GET /api/v1/groups/{groupId}/members?page=
GET /api/v1/groups/{groupId}/submissions?cursor=
GET /api/v1/groups/{groupId}/points             # group-level point balances  (PHP parity)
GET /api/v1/groups/search?q=
GET /api/v1/announcements?scope=global|group:{id}&cursor=
GET /api/v1/announcements/{id}
GET /api/v1/items/{itemId}  /api/v1/npcs/{npcId}   # catalog lookups for rich UI
GET /api/v1/events?groupId=&status=active|past      # public event listing  (PHP parity)
GET /api/v1/events/{eventId}                        # event detail + tasks  (PHP parity)
GET /api/v1/events/{eventId}/teams                  # team roster + scores  (PHP parity)
GET /api/v1/events/{eventId}/bingo                  # bingo board state  (PHP parity)
```

### 6.2 Authenticated (session) reads
```
GET /api/v1/me                                  # user, linked players, group roles, perms
GET /api/v1/me/groups                           # groups I own/admin/belong to
GET /api/v1/me/notifications-config             # personal ping/visibility prefs
GET /api/v1/me/points                           # my point balance + history  (PHP parity)
GET /api/v1/me/upgrades                         # my active premium upgrades  (PHP parity)
```

### 6.3 Authenticated writes
```
PATCH /api/v1/me                                # public flag, ping prefs, patreon_group, premium_group  (PHP parity: account settings)
POST  /api/v1/players/{playerId}/claim          # link an OSRS account to my user (verify flow)
POST  /api/v1/groups                            # create group (wraps create_web_group)
GET   /api/v1/groups/wom-lookup/{womId}         # wizard
GET   /api/v1/groups/guild-status/{guildId}     # wizard
PATCH /api/v1/groups/{groupId}/config           # bulk config upsert (group admin)
GET   /api/v1/groups/{groupId}/config           # typed config (replaces load_config)
POST  /api/v1/groups/{groupId}/wom-sync         # trigger sync (admin)
GET   /api/v1/groups/{groupId}/diagnostics      # pipeline heartbeat
POST  /api/v1/groups/{groupId}/announcements    # create announcement (+ syndicate to Discord)
POST  /api/v1/groups/{groupId}/lootboard/generate  # scoped board image (wraps existing CLI)
POST  /api/v1/submissions/manual                # wraps /manual-submit (multipart, file upload proof)  (PHP parity)
GET   /api/v1/uploads/presign                   # B2 presigned URL (wraps existing)
GET   /api/v1/groups/{groupId}/hidden-players   # ignored-players list  (PHP parity)
PATCH /api/v1/groups/{groupId}/hidden-players   # add/remove ignored players  (PHP parity)
GET   /api/v1/groups/{groupId}/upgrades         # active/expired premium tiers  (PHP parity)
POST  /api/v1/groups/{groupId}/features/{key}/activate   # spend points to activate a feature  (PHP parity)
GET   /api/v1/features                          # browse available premium features  (PHP parity)
GET   /api/v1/features/{key}                    # feature detail + cost + activation options  (PHP parity)
POST  /api/v1/events                            # create event  (PHP parity)
PATCH /api/v1/events/{eventId}                  # update event  (PHP parity)
POST  /api/v1/events/{eventId}/tasks            # add task to event  (PHP parity)
POST  /api/v1/events/{eventId}/teams            # add team  (PHP parity)
```

### 6.4 Realtime
```
GET /api/v1/stream?channels=global,group:{id},player:{id}   # SSE
```

### 6.5 Contract conventions
- **Pagination:** cursor-based for feeds (`submissions`, `announcements`), page/limit for leaderboards.
- **Money:** return both raw integer GP (`value`) and a preformatted string (`value_formatted`) so clients don't reimplement `format_number`.
- **Errors:** RFC-7807-style `{ "type", "title", "status", "detail" }`.
- **Caching:** public reads send `Cache-Control` + `ETag`; the BFF additionally uses Next.js `revalidate`/ISR.
- **Versioning:** breaking changes go to `/api/v2`; v1 stays stable for any external consumers.
- **Time partitions:** accept `period` values of `YYYYMM` (monthly), `YYYYWW` (weekly), `YYYYMMDD` (daily), or `all` to match the full range the PHP leaderboard filters support.
- **File uploads:** `/api/v1/submissions/manual` accepts `multipart/form-data` for drop proof images/videos, consistent with the PHP `Groups::actionManualSubmission()` flow.

---

## 7. Authentication & Authorization

### 7.1 Flow (Discord OAuth, backend issues session)
1. User clicks **Sign in with Discord** → BFF redirects to Discord OAuth (`identify`, `guilds` scopes; `email` optional).
2. Discord redirects to BFF callback (`/api/auth/callback`). BFF exchanges the code (server-side, using `DISCORD_BOT_CLIENT_ID`/`SECRET` already in `.env`).
3. BFF calls Web API `POST /api/v1/auth/discord` with the Discord profile → backend **finds-or-creates** the `users` row by `discord_id` (reusing existing `try_create_user`-style logic), returns the canonical `user_id`, linked players, and group roles.
4. Backend mints a **signed session** (JWT — `JWT_TOKEN_KEY` already exists — or an opaque session stored in Redis). BFF sets it as an **httpOnly, Secure, SameSite=Lax** cookie. The browser never sees a backend token.
5. Subsequent BFF→Web-API calls forward the session; the API validates and resolves `user_id` + permissions.

> The `guilds` scope lets us auto-detect which Discord servers the user can
> manage (`MANAGE_GUILD`), which we cross-reference with `guilds.group_id` to
> grant group-admin rights without manual role assignment.
>
> **PHP parity note:** The existing `Groups::actionCreateDiscordAuth()` /
> `actionCreateDiscordCallback()` implements exactly this OAuth consent +
> token-exchange flow for the group creation wizard. The new BFF generalises
> that pattern as the primary sign-in mechanism, so group creation no longer
> requires a separate OAuth step.

### 7.2 Authorization model
- **Roles:** `superadmin` (site staff), `group_owner`, `group_admin`, `member`, `anonymous`.
- **Group admin derivation:** a user is a group admin if they (a) created/own the group, (b) have `MANAGE_GUILD` on the linked Discord guild, or (c) are explicitly granted (new `group_admins` table — see §13).
- **Player ownership:** writes to a player (claim, hide) require the player's `user_id` to match the session, or superadmin.
- **Every write route** runs a server-side policy check; the UI hides controls the user lacks, but the **API is the source of truth** (never trust the client).

### 7.3 Account linking (OSRS player ↔ Discord user)
Players are created by the plugin keyed on `account_hash`. To *claim* a player on
the web:
- **Option A (recommended):** in-game/plugin-assisted code — backend issues a short code, user enters it in the plugin (or vice-versa), backend binds `players.user_id`. Strongest proof of ownership.
- **Option B:** Discord-side verification if the account was previously linked via the bot.
- The new `players/{id}/claim` endpoint encapsulates whichever flow we choose; the existing 16-char `auth_token` on `users` can seed it.

### 7.4 Retire `XF_KEY` for browser flows
`XF_KEY` server-to-server stays only for any remaining machine integrations
during transition; the browser path is fully replaced by sessions. After XenForo
is decommissioned, `xf_user_id` becomes vestigial (retain the column for
historical mapping, stop writing to it).

---

## 8. Real-Time Data Architecture

### 8.1 Transport: SSE first
- **Server-Sent Events** over a single `GET /api/v1/stream` endpoint. Simpler than WebSockets, works through HTTP/2, auto-reconnect built into `EventSource`, and the data is one-directional (server→client) which fits leaderboards and feeds.
- Upgrade to **WebSockets** only if/when we add interactive features (live chat, presence).

### 8.2 Source of events: Redis pub/sub
We **publish** events at the exact points the backend already does work, with
zero change to processing semantics:
- In `services/redis_updates.py` (right after a leaderboard mutation) → publish `drop`/`leaderboard_delta` to channels `global`, `group:{id}`, `player:{id}`, `npc:{id}`.
- In the `NotificationService` drain loop (or `notification_queue` write) → publish notable-submission events for live feeds.
- New announcement creation → publish `announcement` to the relevant scope.

The realtime gateway (a lightweight async consumer in the Web API process)
subscribes to Redis channels and relays to the SSE clients filtered by the
channels they requested.

### 8.3 Event envelope
```json
{
  "v": 1,
  "type": "drop | leaderboard_delta | announcement | submission",
  "scope": "global | group:123 | player:456 | npc:789",
  "ts": 1719000000,
  "data": { /* type-specific, already-formatted for display */ }
}
```

### 8.4 Client strategy
- First paint: Server Component renders cached snapshot (SSR/ISR) → instant, SEO-friendly.
- Hydration: client subscribes to `/api/v1/stream` for its scope; applies deltas to the rendered list (optimistic, capped, debounced).
- Fallback: if SSE drops, TanStack Query polls at a low frequency.

### 8.5 Canonicalize Redis keys (prerequisite)
Before building live leaderboards, **standardize the group key scheme** (see
§2.4 warning). Recommended canonical forms:
```
leaderboard:{YYYYMM}                          # global monthly
leaderboard:{YYYYMM}:group:{groupId}          # per-group monthly
leaderboard:{YYYYMM}:npc:{npcId}              # per-npc (global) monthly
leaderboard:{YYYYMM}:group:{groupId}:npc:{npcId}
leaderboard:{YYYYWW}:...                      # weekly variants (PHP parity)
leaderboard:{YYYYMMDD}:...                    # daily variants  (PHP parity)
leaderboard:all:...                           # all-time variants  (PHP parity)
player:{playerId}:{YYYYMM}:total_loot
pubsub channel: rt:{scope}                    # e.g. rt:group:123
```
Reconcile the divergent reads in `api/routes/groups.py` and
`Player.get_score_at_npc` to this scheme (a small backend change tracked as a
prerequisite task, not part of the front-end repo).

---

## 9. Feature & Page Inventory

### Public (SSR/ISR, anonymous)
- **Home / global leaderboard** — top players & groups this month, live-updating, period switcher. Homepage also surfaces featured/highlighted players (weighted by premium status, as in the PHP `Player::actionHighlighted()`) and global contributor recognition.
- **Player profile** — total loot, global rank, rank-by-NPC, NPC-organised loot table, recent submissions (drops/PBs/CLogs), points, group memberships. Quick-view tooltip card.
- **Group profile** — stats (members, rank, monthly loot), top player, recent submissions, members list, lootboard/live board, public Discord invite.
- **NPC/boss leaderboards** — per-NPC top loot/KC.
- **Announcements** — global + per-group news feed, individual announcement pages (SEO-indexed; this is the XenForo "thread" replacement).
- **Search** — players & groups.
- **Events** *(PHP parity)* — public event listing (active/past), event detail (tasks, teams, bingo board state).
- **Feature store** *(PHP parity)* — browse available premium features, view point costs, read activation options. Points are earned in-game via drops/achievements and spent here.

### Authenticated dashboard
- **My accounts** — linked OSRS players, claim new account, set visibility, personal stats.
- **My groups** — groups I belong to / own / admin.
- **Notification & privacy prefs** — ping settings (`global_ping`, `group_ping`, `never_ping`, `public`, `hidden`), DM-on-rank-change, DM-on-points, update logs opt-in *(PHP parity: all from `/account/droptracker`)*.
- **My points** *(PHP parity)* — balance, credit/debit history, active feature activations.
- **My premium** *(PHP parity)* — active group upgrades, Patreon group selection (`patreon_group`), premium group preference (`premium_group`).
- **Manual submission** — submit a drop/clog/pb/ca/pet with optional image/video proof (wraps `/manual-submit` + B2 presign; multipart upload as in the PHP form).

### Group admin
- **Group settings** — typed config editor (see §11) replacing `load_config` + Discord commands. Full 55+ key schema from the PHP `Groups::actionConfig()`.
- **Members** — view, ignore/unignore (`ignored_players`), WOM sync button + result, role grants.
- **Group creation wizard** — Discord OAuth → server selection → WOM lookup → guild status → create (mirrors the PHP multi-step flow in `Groups::actionCreate*`).
- **Announcements composer** — write, preview, publish, choose "also post to Discord".
- **Lootboard** — configure theme, generate timeframe/NPC board, embed live board.
- **Diagnostics** — pipeline heartbeat (`admin_diagnostics`): is intake healthy, last submission, 7-day activity.
- **Points/premium** *(PHP parity)* — view ledgers (`point_credits`/`point_debits`), group point balance, active features, premium upgrade tier status.
- **Events** *(PHP parity)* — create/manage events, add tasks (item_collection, kc_target, xp_target, ehp_target, ehb_target, pb_target, skill_target), manage teams, bingo board designer.

### Site admin (superadmin)
- Global announcements, group/user moderation, feature/premium toggles, system health/metrics dashboard.
- **Feature management** *(PHP parity)* — create/edit premium feature definitions (key, name, description, scope player|group|both, point cost, duration, multiple-activations flag).
- **Global search/lookup** *(PHP parity)* — cross-content search (players, groups, drops, collection logs, PBs, CAs, pets, items, NPCs) with date-range and match-mode filters.
- **Service management** *(PHP parity)* — start/stop/restart the three backend services (droptracker-core, droptracker-api, droptracker-webhooks), view journalctl logs. (Implementation: the new Web API exposes a superadmin-only endpoint that invokes `systemctl` on the backend host via an SSH tunnel or a local privileged script — mirroring the PHP `ServiceManagement` controller's approach.)

> **Out of scope for the new web front-end:** the admin SQL executor
> (`/admin/sql-exec`) will **not** be ported. Direct SQL execution over HTTP is
> a security anti-pattern; admins should use a proper DB client.

---

## 10. Announcements → Discord Syndication

The only "forum-like" feature we keep. Lightweight by design.

### 10.1 Behavior
- An **announcement** has: `scope` (global or group), `title`, `body` (Markdown), `author_user_id`, `published_at`, `discord_message_ref` (nullable), `pinned`, optional `tags`/`cover_image`.
- On publish, if "post to Discord" is enabled for the scope, the backend enqueues a Discord post to the group's configured announcements channel (new config key, e.g. `announcements_channel_id`) and stores the returned message reference for edit/delete sync.
- Edits/unpublish can optionally update/delete the Discord message (best-effort, like the existing notification flow).
- Web page is the canonical, SEO-indexed source; Discord is the syndication target. This inverts today's Discord-first model and gives shareable links.

### 10.2 Implementation
- New `announcements` table (§13).
- Reuse the existing async pattern: web API writes the row + (optionally) a `notification_queue`-style job; the Discord bot process picks it up and posts. **No new Discord connection from the web API** — it delegates to the bot, consistent with current architecture ("processors never send Discord messages directly").
- Realtime: publish an `announcement` event so open browsers show it instantly.

---

## 11. Group Configuration Management UI

Today config is a sprawling key/value table read in ad-hoc ways (`load_config`,
processors, slash commands). The new platform gives it a **typed schema** and a
single editor.

### 11.1 Config schema registry

The PHP `Groups::actionConfig()` handler reveals **55+ config keys** organised
into the following categories (reproduced here for implementation reference):

| Category | Keys |
|---|---|
| **Channels** | `drop_channel_id`, `lootboard_channel_id`, `lootboard_message_id`, `level_channel_id`, `pb_channel_id`, `ca_channel_id`, `pet_channel_id`, `quest_channel_id`, `announcements_channel_id` |
| **Drop notifications** | `minimum_value_to_notify`, `only_include_items_over_minimum`, `only_send_messages_with_images`, `send_stacks_of_items`, `notify_clogs`, `notify_cas`, `notify_pets`, `notify_quests`, `notify_special_quests` |
| **Level notifications** | `notify_levels`, `level_minimum_for_notifications`, `level_increment`, `level_milestones`, `post99_xp_interval` |
| **Personal best** | `notify_pbs`, `personal_best_embed_boss_list`, `number_of_pbs_to_display`, `channel_id_to_send_pb_embeds` |
| **Combat achievements** | `min_ca_tier_to_notify` |
| **Board settings** | `loot_board_type`, `use_dynamic_colors`, `use_gp_colors`, `repost_lootboard`, `seasonal_boards` |
| **Points** | `split_gp_tracking` |
| **Misc/integration** | `clan_chat_name`, `auto_provision_members`, `discord_url`, `group_description`, `group_name`, `export_api_key` |

Seasonal mirrors (`seasonal_*` prefix) exist for most notification keys. The
typed registry (Zod/Pydantic) must enumerate all of the above with labels, help
text, defaults, and validation.

### 11.2 UX
- Grouped, form-driven editor (Notifications / Lootboard / Points / Integrations / Seasonal).
- Channel pickers populated from the group's Discord guild (via bot, using the `guilds` data we already have access to).
- A typed `GET/PATCH /api/v1/groups/{id}/config` endpoint reads/writes `group_configurations` with validation, replacing the loosely-typed `load_config`. The plugin-facing `load_config` stays for the RuneLite client (backwards compatibility) until the plugin is updated.
- Seasonal mirror toggle writes `seasonal_`-prefixed keys.

---

## 12. Lootboards & Media

- **Short term:** keep the existing Pillow image generator. Surface generated boards via the existing `generate-timeframe-board` / `board_update` endpoints, wrapped by `/api/v1/groups/{id}/lootboard/generate`. Serve images from their current public path.
- **Long term:** render boards **natively in React** from live data (no PNG round-trip), which is faster, interactive (hover for KC/value, click-through to drops), and removes the subprocess/CLI dependency. Keep image export as a "share to Discord/social" affordance.
- **Video/screenshots:** reuse the B2 presigned-upload flow (`/presigned_upload_url`, `/video/upload-complete`) behind `/api/v1/uploads/presign`.

---

## 13. Data Model Additions Required

New tables (Alembic migrations in the **backend** repo, since they live in the
`data` DB). Front-end repo only consumes them via the API.

```
web_sessions            # if using opaque sessions instead of stateless JWT
  id, user_id, created_at, expires_at, user_agent, ip, revoked

oauth_states            # CSRF/nonce for the Discord OAuth dance (or handle in Redis)
  state, created_at, redirect

group_admins            # explicit web-granted admin rights (beyond owner/MANAGE_GUILD)
  id, group_id, user_id, role(owner|admin), granted_by, created_at

announcements
  id, scope_type(global|group), group_id(nullable), author_user_id,
  title, body_md, cover_image_url(nullable), pinned(bool),
  status(draft|published|archived), published_at,
  discord_message_id(nullable), discord_channel_id(nullable),
  created_at, updated_at

audit_log               # who changed what config / made admin actions
  id, actor_user_id, group_id(nullable), action, target, before, after, created_at
```

Plus a new config key convention: `announcements_channel_id` (and
`seasonal_announcements_channel_id`).

> Sessions can be **stateless JWT** (no `web_sessions` table) if we accept that
> revocation requires short TTLs + a deny-list in Redis. Recommendation:
> short-lived access token (JWT) + refresh stored in Redis for revocability.

---

## 14. XenForo Decommission & Migration

> This section has been updated with **exact PHP feature parity** based on a
> full review of the `DropTrackerXFAddons` codebase (7 addon packages,
> 170+ PHP files). Items are marked as **Migrate**, **Replace**, or **Drop**.

### 14.1 What we must carry over

| Feature | PHP Location | Disposition | Notes |
|---|---|---|---|
| User identity | `Core/Entity/User.php` (XF extension) | **Migrate** | Discord-keyed already; first Discord login re-binds `users` row. `xf_user_id` retained as dead column. |
| Group ownership/roles | `group_admins` seed | **Migrate** | Seed from existing group creators + `MANAGE_GUILD` users. |
| Player profiles | `Pages/Pub/Controller/Player.php` | **Replace** | New `/api/v1/players/{id}` covers all of `actionView`, `actionDrops`, `actionPoints`, `actionTopRanks`. |
| Group dashboards | `Pages/Pub/Controller/Groups.php` | **Replace** | All ~18 group actions → new `/api/v1/groups/{id}/*` endpoints. |
| Leaderboards | `Pages/Pub/Controller/Leaderboard.php` | **Replace** | Must support daily/weekly/monthly/all-time partitions (not just monthly). |
| Group config (55+ keys) | `Groups::actionConfig()` | **Replace** | New typed config API (§11). Key list fully documented in §11.1. |
| Group creation wizard | `Groups::actionCreate*()` | **Replace** | New multi-step wizard: Discord OAuth → server select → WOM lookup → create. |
| Manual submission (with file proof) | `Groups::actionManualSubmission()` | **Replace** | `POST /api/v1/submissions/manual` (multipart). |
| Board generator | `Groups::actionBoardGenerator()` | **Replace** | `/api/v1/groups/{id}/lootboard/generate`. |
| Hidden players | `Groups::actionHiddenPlayers()` | **Replace** | `GET/PATCH /api/v1/groups/{id}/hidden-players`. |
| Group points dashboard | `Groups::actionPointsDashboard()` | **Replace** | `/api/v1/groups/{id}/points`. |
| Group diagnostics | `Groups::actionDiagnostics()` | **Replace** | `/api/v1/groups/{id}/diagnostics`. |
| Account settings (all prefs) | `Pages/Pub/Controller/Account.php` | **Replace** | `PATCH /api/v1/me` — privacy, pings, DM prefs, patreon_group, premium_group. |
| Premium feature store | `Pages/Pub/Controller/FeatureStore.php` | **Replace** | `/api/v1/features` browse + `/api/v1/groups/{id}/features/{key}/activate`. |
| Group upgrade tiers | `/Upgrades/` | **Replace** | `/api/v1/groups/{id}/upgrades`; upgrade/downgrade lifecycle stays in backend services. |
| Featured/highlighted players | `Player::actionHighlighted()` | **Replace** | `/api/v1/players/highlighted` (weighted by premium status). |
| Player tooltips | `Player::actionTooltip()` | **Replace** | Inline component from profile data; no separate endpoint needed. |
| Events system | `/Events/` | **Migrate (Phase 6)** | Full event/task/team/bingo system. Defer to Phase 6 (see §17); keep old PHP UI live until migrated. |
| Documentation / wiki | `/Docs/` | **Decision needed** | User-editable pages with edit history. Options: (a) migrate to the new site, (b) replace with static MDX in the repo, (c) point to an external wiki. Recommend static MDX for Phase 1; full wiki if community edits prove necessary. |
| Admin: feature management | `Admin/Pub/Controller/Features.php` | **Replace** | Site-admin panel: create/edit feature definitions. |
| Admin: global search/lookup | `Admin/Pub/Controller/Lookup.php` | **Replace** | Cross-content search for superadmins. |
| Admin: service management | `Admin/Pub/Controller/ServiceManagement.php` | **Replace** | Superadmin-only API endpoint calling `systemctl` on backend host. |
| Admin: Discord message sender | `Admin/Controller/DropTracker.php::actionSendMessage()` | **Replace** | Superadmin Discord send panel. |
| Admin: SQL executor | `Admin/Pub/Controller/Dashboard.php::actionSqlExec()` | **Drop** | Security anti-pattern; admins use a proper DB client. |
| Homepage announcements feed | `Pages/Pub/Controller/Home.php` | **Replace** | New announcements system (§10). Contributor section via API. |
| Patreon integration | `Core/Service/Patreon.php` | **Retain in backend** | Web API exposes user's Patreon status; the sync logic stays in the backend service layer. |

### 14.2 URL map for 301 redirects

All of the following XenForo URLs must redirect to their new equivalents:

| Old XenForo URL | New URL | Notes |
|---|---|---|
| `/players` | `/players` | Same slug |
| `/players/view/{id}` | `/players/{id}` | |
| `/players/view/{name}` | `/players/search?q={name}` | Name → search or canonical ID route |
| `/players/ranks` | `/leaderboards` | |
| `/players/{id}/drops` | `/players/{id}/drops` | |
| `/players/{id}/points` | `/players/{id}/points` | |
| `/groups` | `/groups` | |
| `/groups/{id}` | `/groups/{id}` | |
| `/groups/{id}/config` | `/groups/{id}/settings` | |
| `/groups/{id}/dashboard` | `/groups/{id}/admin` | |
| `/groups/{id}/manual-submission` | `/submit` (authed dashboard) | |
| `/groups/{id}/board-generator` | `/groups/{id}/lootboard` | |
| `/groups/{id}/points` | `/groups/{id}/points` | |
| `/groups/create` | `/groups/new` | |
| `/leaderboard` | `/leaderboards` | |
| `/feature-store/{groupId}` | `/groups/{groupId}/features` | |
| `/account/droptracker` | `/settings` | |
| `/account/premium` | `/settings/premium` | |
| `/docs/{slug}` | `/docs/{slug}` (or external) | Depends on docs disposition decision |

### 14.3 Cutover strategy (strangler pattern)
1. Stand up `app.droptracker.io` (or a staging host) with the new site reading live data — **no writes**, runs alongside XenForo.
2. Move read traffic page-by-page (leaderboards → profiles → groups), validating parity.
3. Enable auth + dashboard + group admin on the new site; freeze the equivalent XenForo pages.
4. Switch the apex domain to the new site; keep XenForo reachable read-only at a subdomain during a grace period.
5. Decommission XenForo + the PHP addons + retire `XF_KEY` browser usage.
6. Events system remains on the old PHP site (behind the subdomain) until Phase 6 migration is complete.

### 14.4 Backend touch-points during migration
- Add `/api/v1` (new) without removing the existing website endpoints until cutover completes.
- Add Redis pub/sub publishes (additive, safe).
- Tighten/relax CORS: the new site origin replaces `https://www.droptracker.io` pinning where appropriate, or the BFF eliminates browser-CORS entirely (browser only talks to Next.js).

---

## 15. Non-Functional Requirements

- **Performance:** P95 page TTFB < 300ms for cached public pages (ISR); leaderboard reads served from Redis + short-TTL cache; the Web API never blocks on WOM/OSRS calls in a request path (defer to background jobs).
- **Scalability:** Web API is stateless and horizontally scalable; realtime gateway scales with Redis pub/sub fan-out; Next.js on serverless/edge or containers.
- **SEO:** SSR/ISR for all public pages; structured data (JSON-LD) for player/group profiles; sitemap + canonical URLs; 301s from old XenForo URLs.
- **Accessibility:** WCAG 2.1 AA; keyboard nav; Radix/shadcn accessible primitives; color contrast in the OSRS theme.
- **Security:** httpOnly+Secure+SameSite cookies; CSRF protection on state-changing routes; server-side authorization on every write; rate limiting on the Web API; secrets only on the server; input validation via Zod/Pydantic; audit log for admin actions.
- **Observability:** structured request logging (reuse `db/app_logger.py` patterns), metrics (extend the existing `/metrics`), front-end error tracking (Sentry), realtime connection metrics.
- **Reliability:** the Web API failing must **never** affect the RuneLite intake (separate process/pool). Graceful SSE reconnect + polling fallback.
- **i18n-ready:** copy externalized even if we ship English-only first.

---

## 16. Infrastructure, Deployment & CI/CD

- **Front-end (Next.js):** Vercel (fastest path, native ISR/edge) **or** self-hosted Node container behind the existing reverse proxy. Decision depends on whether data must stay on-prem.
- **Web API:** containerized Quart (Hypercorn) as a new process/service alongside the existing API, **separate systemd unit / screen** (mirroring `droptracker-api-dev` on a new port, e.g. 31325), separate DB pool.
- **Realtime gateway:** part of the Web API process initially; split out if connection counts grow.
- **CI (GitHub Actions):** lint + typecheck (TS + mypy) + unit tests + build; generate OpenAPI → publish `api-types`; preview deploys per PR; contract tests verifying the Web API matches the published OpenAPI.
- **Config:** `.env` parity with backend for shared secrets (`DISCORD_BOT_CLIENT_ID/SECRET`, `DISCORD_REDIRECT_URI`, `JWT_TOKEN_KEY`, Redis/DB creds), plus new front-end vars (`NEXTAUTH_URL`, session secret, API base URL).
- **Environments:** `dev` (mirrors `droptracker-api-dev`), `staging` (cutover validation), `prod`.

---

## 17. Phased Roadmap

### Phase 0 — Foundations (backend prerequisites)
- Stand up the new **Web API v1** skeleton (separate process, own pool, OpenAPI).
- **Canonicalize Redis leaderboard keys** (daily/weekly/monthly/all-time variants) and reconcile divergent reads (§8.5).
- Add **Redis pub/sub publishes** at leaderboard-mutation / notification points (additive).
- Implement **Discord OAuth + session issuance** (`/api/v1/auth/discord`, `/api/v1/me`).

### Phase 1 — Public read site (no writes)
- Next.js app + BFF + design system.
- Global/player/group/NPC leaderboards and profiles (SSR/ISR) with live SSE updates.
- Search. Deploy alongside XenForo; validate data parity.

### Phase 2 — Identity & dashboard
- Sign in with Discord; `/me`; account claiming; notification/privacy/DM prefs; patreon/premium group settings.
- Manual submission (multipart) + media upload.
- My points + feature store (browse + activate).

### Phase 3 — Group admin
- Typed config editor (full 55+ key schema); members + WOM sync; group creation wizard; diagnostics; points ledgers; hidden players; group upgrade status.

### Phase 4 — Announcements + Discord syndication
- Announcements CRUD, publish, Discord cross-post via the bot; live announcement events.

### Phase 5 — Cutover & decommission
- 301 redirects, domain switch, XenForo read-only grace period, then shutdown + `XF_KEY` browser retirement.
- Events system kept on legacy subdomain during grace period.

### Phase 6 — Enhancements
- Events system migration (event/task/team/bingo CRUD).
- Native (React-rendered) interactive lootboards; richer analytics/charts; superadmin tooling; service management panel.
- Documentation/wiki (decision: static MDX or full user-editable wiki).
- Optional WebSocket features.

---

## 18. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Adding web reads to the existing API worsens intake latency | High | **Separate Web API process + pool**; the intake `/webhook` path is untouched. |
| Redis key-scheme inconsistency causes wrong leaderboards | High | Canonicalize keys in Phase 0 before building live UIs; add tests. |
| `top_groups` recomputes over all groups per request | Med | Precompute group totals into a Redis sorted set (maintained on drop writes) and read like player leaderboards. |
| Account-ownership spoofing during web "claim" | High | Plugin-assisted verification code; never bind on name alone (consistent with WOM-as-truth rule). |
| Discord API rate limits for OAuth/guild checks | Med | Cache guild/bot-presence (pattern already exists in `group_create.py`); short-TTL Redis caches. |
| SEO regression at cutover | Med | 301 map from XenForo URLs (§14.2); sitemaps; staged read-traffic migration. |
| Realtime fan-out load | Med | SSE + Redis pub/sub; cap event rate, debounce deltas, polling fallback. |
| Scope creep into a full forum | Med | Hard non-goal; announcements only. |
| Two-repo contract drift | Med | OpenAPI is the single source of truth; generated TS types; contract tests in CI. |
| Events system left stranded during transition | Med | Keep PHP events UI alive on legacy subdomain until Phase 6 migrates it. |
| Docs disposition (wiki vs. static) | Low | Decision deferred; static MDX ships first — full wiki only if community editing proves necessary. |

---

## 19. Open Questions / Decisions Log

**Resolved:** scope (replace XenForo, announcements-only), stack (Next.js/TS),
auth (Discord OAuth primary), integration (new dedicated API + BFF).

**Still to decide:**
1. **Web API placement** — recommend Option A (lives in backend repo, imports `db/`/`services/`; front-end repo consumes its OpenAPI). Confirm.
2. **Session style** — stateless JWT (short TTL) + Redis refresh/deny-list (recommended) vs. server-side `web_sessions`.
3. **Account-claim mechanism** — plugin-assisted code vs. Discord-bot-assisted vs. both.
4. **Hosting** — Vercel vs. self-hosted Next.js (data residency / cost).
5. **Auth.js vs. custom OAuth handler** — recommend Auth.js Discord provider for the dance, backend-authoritative session.
6. **Native vs. image lootboards** — keep images short-term; commit to native render timeline.
7. **Old announcement content** — is there any XenForo news worth a one-time import?
8. **Documentation disposition** — static MDX in repo, full user-editable wiki on the new site, or external wiki (Notion/Confluence)?
9. **Events migration timeline** — events system is substantial (entity-heavy: tasks, teams, bingo, effects, cooldowns). Confirm Phase 6 timeline and whether old PHP UI stays on a subdomain as-is or gets a minimal read-only port earlier.

---

## 20. Appendices

### 20.1 Existing backend endpoints → new API mapping

| Existing | New v1 | Notes |
|---|---|---|
| `GET /top_players` | `GET /api/v1/leaderboards/players?scope=global` | add paging + period granularity |
| `GET /top_groups` | `GET /api/v1/leaderboards/groups` | precompute totals in Redis |
| `GET /player_search?name=` | `GET /api/v1/players/{id}` + `/search` | split profile vs. search |
| `GET /group_search?name=` | `GET /api/v1/groups/{id}` + `/search` | |
| `GET /load_config` | `GET /api/v1/groups/{id}/config` (typed) | keep `load_config` for plugin |
| `POST /groups/create` | `POST /api/v1/groups` | session auth, not `XF_KEY` |
| `GET /groups/guild-status/{id}` | same under `/api/v1` | session auth |
| `GET /groups/wom-lookup/{id}` | same under `/api/v1` | |
| `POST /groups/{id}/wom-sync` | `POST /api/v1/groups/{id}/wom-sync` | session/role auth |
| `GET /groups/admin_diagnostics/{id}` | `GET /api/v1/groups/{id}/diagnostics` | |
| `POST /generate-timeframe-board` | `POST /api/v1/groups/{id}/lootboard/generate` | |
| `POST /manual-submit` | `POST /api/v1/submissions/manual` | multipart, file proof |
| `GET /presigned_upload_url` | `GET /api/v1/uploads/presign` | |
| `GET /ping`,`/health`,`/metrics` | reuse | ops |

### 20.2 Environment variables (new front-end / web API)
```
# Shared with backend
DISCORD_BOT_CLIENT_ID=        # OAuth client id (exists)
DISCORD_BOT_CLIENT_SECRET=    # OAuth secret (exists)
DISCORD_REDIRECT_URI=         # now points at BFF callback
JWT_TOKEN_KEY=                # session signing (exists)
REDIS_URL= / DB creds         # shared

# Front-end (Next.js)
NEXT_PUBLIC_API_BASE=         # web API base (or same-origin via BFF)
SESSION_COOKIE_SECRET=
NEXTAUTH_URL=                 # if using Auth.js
WEB_API_INTERNAL_URL=         # BFF → Web API (server-side only)
```

### 20.3 Example: live leaderboard event (SSE)
```
event: leaderboard_delta
data: {"v":1,"type":"leaderboard_delta","scope":"group:42","ts":1719000000,
       "data":{"player_id":1337,"player_name":"Zezima","total_loot":123456789,
               "total_loot_formatted":"123.5M","rank":3,"delta":2500000}}
```

### 20.4 First-PR checklist for the new repo
- [ ] Monorepo scaffold (pnpm + Turborepo), `apps/web` Next.js app.
- [ ] Tailwind + component library + OSRS theme tokens.
- [ ] OpenAPI consumed → `packages/api-types` generated client.
- [ ] BFF Discord OAuth callback + session cookie.
- [ ] Public global leaderboard page (SSR) reading Web API v1.
- [ ] SSE hook + live-update wiring on the leaderboard.
- [ ] CI: lint, typecheck, build, contract test against OpenAPI.

### 20.5 PHP addon feature inventory (reference)

A full audit of `DropTrackerXFAddons` (7 packages, 170+ PHP files) was
completed and used to produce this document. Key findings that informed §6 and
§14:

- **`/Pages`** — Main public site: `Groups.php` (1805 lines, 18+ actions), `Player.php` (560 lines), `Leaderboard.php`, `FeatureStore.php`, `Account.php` (premium/settings extension). Discord OAuth for group creation is a full consent → callback → token-exchange flow already live in `Groups::actionCreateDiscordAuth/Callback()`.
- **`/Admin`** — `ServiceManagement.php` (systemd control via SSH/sudo), `Lookup.php` (cross-content admin search), `Dashboard.php::actionSqlExec()` (SQL executor — not porting, see §9), `Features.php` (feature CRUD).
- **`/Events`** — Complete event system: events, tasks (7 types), teams, bingo boards, effects, cooldowns, shop items. Entity-heavy; deferred to Phase 6.
- **`/OldEvents`** — Deprecated predecessor to `/Events`; maintained for backwards compatibility. No migration needed.
- **`/Docs`** — User-editable wiki with hierarchical pages and edit history. Disposition TBD (§19 item 8).
- **`/Upgrades`** — Group premium tier management (upgrade/downgrade lifecycle, expiration, notifications).
- **`/Core`** — Foundation: `Database.php` (cross-DB connector), `Redis.php`, `DiscordInterface.php`, `PointService.php`, `FeatureService.php`, `Patreon.php`, `SemanticDropUpdater.php`, `GroupAdminSetupService.php`, `User/UpgradeService.php`.
- **Config keys:** 55+ `group_configurations` keys catalogued in §11.1. Leaderboard time partitions include daily (`YYYYMMDD`), weekly (`YYYYWW`), monthly (`YYYYMM`), and all-time — all must be supported in the new API (§6.5).

---

*Prepared from a review of the DropTracker backend (`api/`, `db/`, `services/`,
`docs/ARCHITECTURE.md`, `docs/REFACTOR_PLAN.md`) and a full audit of the
`DropTrackerXFAddons` PHP codebase (7 addon packages across `/Core`, `/Pages`,
`/Admin`, `/Events`, `/OldEvents`, `/Docs`, `/Upgrades`). §6 and §14 have been
updated with exact PHP feature parity.*
