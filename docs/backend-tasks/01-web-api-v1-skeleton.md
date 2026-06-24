# Task 01 — Web API v1 skeleton

**Goal:** stand up a new, versioned, browser-oriented JSON API as a **separate
process** from the RuneLite intake API, with its own DB pool, shared conventions
(errors, pagination, money), and a published OpenAPI document.

**Plan refs:** FRONTEND_PLAN.md §3.1, §3.2, §4 (Web API), §6.5, §16.

## Why separate

The intake API (`:31323`) already suffers pool exhaustion under submission load.
Adding read-heavy website traffic to it makes that worse and couples two very
different workloads. The Web API must be independently scalable and deployable.
See §3.2 and the Risks table (§18).

## Deliverables

1. A new Quart app (recommended: `web_api/` package next to `api/` in the backend
   repo) exposing routes under the `/api/v1` prefix.
2. Its own `Hypercorn` entrypoint / systemd unit, on **port `:31325`** (mirror
   the existing `droptracker-api-dev` unit; new unit e.g. `droptracker-webapi`).
3. A **dedicated SQLAlchemy engine + session pool**, smaller and tuned for
   read-heavy traffic. Do **not** reuse the intake app's pool.
4. Shared response conventions implemented once as helpers/middleware.
5. A generated `openapi.json`, kept consistent with the web repo's vendored copy.

## Structure (suggested)

```
web_api/
  __init__.py
  app.py            # create_app(): Quart app, blueprints, error handlers, CORS
  pool.py           # dedicated engine/sessionmaker (read-tuned)
  deps.py           # session resolution, current_user, pagination parsing
  errors.py         # RFC-7807 problem responses
  schemas/          # Pydantic models (request/response) -> OpenAPI
  v1/
    __init__.py     # register_blueprints(app)
    leaderboards.py
    players.py
    groups.py
    announcements.py
    auth.py
    me.py
    config.py
    submissions.py
    realtime.py
```

Reuse existing modules by import: `db/models`, `services/redis_updates`,
`db.group_creation`, `utils/`, etc. Keep business logic in those modules.

## Conventions to implement (match the contract)

### Money envelope
Every GP value is returned as:
```json
{ "value": 123456789, "value_formatted": "123.5M" }
```
Reuse the backend's existing `format_number` for `value_formatted` so clients
never reimplement it (§6.5).

### Errors — RFC-7807
```json
{ "type": "about:blank", "title": "Not found", "status": 404, "detail": "..." }
```
Content-Type `application/problem+json` (or `application/json`). Provide a helper
`problem(status, title, detail=None)` and register Quart error handlers.

### Pagination
- **Leaderboards:** `page` (1-based) + `limit` (default 25, max 100). Response:
  `{ period, scope, entries: [...], meta: { page, limit, total } }`.
- **Feeds** (`submissions`, `announcements`): **cursor**-based — `cursor` query
  param, response includes `next_cursor` (nullable).

### Caching (public reads)
Send `Cache-Control` (short TTL, e.g. `public, max-age=15`) and an `ETag`. The
BFF layers ISR on top. Authed reads: `private, no-store`.

### Time partitions (§6.5)
Accept `period` ∈ `YYYYMM` | `YYYYWW` | `YYYYMMDD` | `all`. Provide a parser that
maps a `period` to the canonical Redis key partition (see Task 07).

### Versioning
All routes under `/api/v1`. Breaking changes go to `/api/v2`.

## CORS / BFF boundary

The browser talks only to the Next.js BFF, which calls this API **server-side**.
So:
- Prefer **no public CORS** on the Web API (server-to-server only). Lock it to the
  BFF origin / internal network.
- If any route is ever called from the browser directly, pin
  `allow_origin` to the new site origin (replacing the `https://www.droptracker.io`
  pin). Default posture: internal-only.

## OpenAPI

Generate `openapi.json` from the Pydantic schemas (e.g. via the framework's spec
support or `pydantic` + a small generator). Keep it in sync with
`packages/api-types/openapi.json` in the web repo. A CI contract test on both
sides should assert the paths/shapes match.

## Health/ops
Expose `/api/v1/health` and `/api/v1/ping`; you may reuse the existing
implementations. Extend the existing `/metrics` rather than forking it.

## Acceptance criteria

- `curl :31325/api/v1/health` returns 200 from the new process.
- The process uses a **separate** DB pool (verify: intake pool metrics unaffected
  under web load).
- `problem()` errors and the money/pagination helpers are used by at least one
  real endpoint (Task 04).
- `openapi.json` is generated and served (e.g. at `/api/v1/openapi.json`).
