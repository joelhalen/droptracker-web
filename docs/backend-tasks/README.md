# Backend tasks for the DropTracker Web API v1

> **Audience:** an agent working **inside the DropTracker backend repository**
> (the Python/Quart codebase containing `api/`, `db/`, `services/`, `utils/`).
> **Not** this front-end repo.

These documents specify the backend work required to support the new front-end
platform (`droptracker-web`). They are derived from `FRONTEND_PLAN.md` (vendored
at the root of the web repo) and from the contract this front-end already
consumes. Each task is self-contained: context, exact endpoint contracts,
which existing code to reuse, auth rules, and acceptance criteria.

## Why this exists

The web front-end is a **BFF** (Next.js) that talks to a **new, versioned Web
API v1**. The browser never calls the backend directly. The front-end is already
built against the contract below and runs today on built-in mock data
(`USE_MOCK_API`); wiring it to the real backend is a matter of implementing these
endpoints so the shapes match.

## The contract is the source of truth

The canonical request/response shapes live in the web repo at:

- `packages/api-types/openapi.json` — OpenAPI 3.1 document.
- `packages/api-types/src/index.ts` — Zod schemas (mirror of the OpenAPI types).
- `packages/api-types/src/group-config.ts` — the typed **group-config registry**
  (the 55+ `group_configurations` keys), used verbatim by Task 05.

When implementing an endpoint, match these shapes exactly. Field names, the
money envelope (`{ value, value_formatted }`), the error envelope (RFC-7807),
and pagination conventions are all defined there. If a shape needs to change,
change the OpenAPI/Zod in the web repo first (it regenerates the TS client) and
keep the two in lockstep.

## Architectural guardrails (from FRONTEND_PLAN.md §3, §15, §18)

1. **Separate process / pool.** The Web API v1 must run as its own process with
   its own SQLAlchemy pool and rate limits, **independent of the RuneLite intake
   API on `:31323`**. Recommended port **`:31325`**. Website traffic must never
   compete with submission processing. Reuse models/services by import; do not
   share the request-handling app.
2. **Intake is untouched.** `/webhook` and the submission pipeline get **no**
   behavioral changes. Realtime publishes (Task 07) are strictly additive.
3. **Reuse, don't rewrite.** Identity, group creation, config reads, board
   generation, and uploads already exist. Wrap them; don't reimplement business
   logic.
4. **Authorization is server-side.** Every write validates the session and the
   user's role on the target resource. Never trust the client.

## Task index (suggested order)

| # | Task | Unblocks (front-end) | Plan refs |
|---|---|---|---|
| 01 | [Web API v1 skeleton](./01-web-api-v1-skeleton.md) | everything | §3, §4, §6, §16 |
| 02 | [Discord OAuth + sessions + `/me`](./02-discord-oauth-and-sessions.md) | sign-in, dashboard, admin | §7 |
| 03 | [Account settings (`/me` writes)](./03-account-settings.md) | `/settings` | §9, §11 |
| 04 | [Leaderboards + profiles + search](./04-leaderboards-profiles-search.md) | home, leaderboards, profiles, search | §6.1, §8.5 |
| 05 | [Typed group-config endpoints](./05-group-config-endpoints.md) | `/groups/{id}/settings` | §11 |
| 06 | [Manual submission + uploads](./06-manual-submission-and-uploads.md) | `/submit` | §6.3, §12 |
| 07 | [Realtime SSE + Redis pub/sub + key canonicalization](./07-realtime-and-redis-keys.md) | live updates | §8 |
| 08 | [Data-model migrations](./08-data-model-migrations.md) | 02, 05, 09 | §13 |
| 09 | [Announcements + Discord syndication](./09-announcements.md) | announcements composer + public feed | §10 |
| 10 | [Group management + creation wizard](./10-group-management-and-wizard.md) | admin members/wom-sync/diagnostics, `/groups/new` | §9, §6.3 |

Tasks 01, 08 are foundational. 02 depends on 08 (session/oauth tables, if not
using stateless JWT). 04 can ship first for a read-only public site (Phase 1).
09 depends on 08 (announcements table) + 07 (realtime event). 10 wraps mostly
existing endpoints behind session auth.

## Definition of done (per task)

- Endpoint(s) return the exact contract shapes; verified against the OpenAPI.
- Auth/authorization enforced where specified.
- No regression to `:31323` intake (separate process/pool).
- Unit/contract tests added on the backend side.
- The web repo's `USE_MOCK_API=false` path works end-to-end against your
  endpoint (set `WEB_API_INTERNAL_URL` to your service).
