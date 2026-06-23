# Task 12 — Superadmin surfaces

**Goal:** back the site-staff (superadmin) tools — global announcements, a Discord
message sender, backend service management, cross-content lookup, and
subscription-tier management.

**Plan refs:** FRONTEND_PLAN.md §9 (Site admin), §14.1 (Admin rows), §14.2.

## Gate: who is a superadmin

Add `is_superadmin: boolean` to the `/me` payload (Task 02, `MeSchema`). Derive it
from an existing staff flag/role on `users` (or a small `site_admins` allowlist).
The front-end hides `/admin` for non-staff, but **every** endpoint below must
independently enforce superadmin server-side (return 403 otherwise).

## Global announcements
Reuses Task 09. The front-end posts global announcements via
`POST /api/v1/announcements` with `scope_type:"global"`. Restrict that route to
superadmin. Everything else (publish + optional Discord syndication via the bot)
is identical to Task 09.

## Discord message sender (§14.1 `actionSendMessage`)
```
POST /api/v1/admin/discord/send   (superadmin)
{ "channel_id": "123...", "content": "..." }   -> 204 / { ok: true }
```
- Enqueue the message for the bot to send (reuse the `notification_queue`
  pattern); **do not** open a Discord connection from the Web API (§10.2 rule).
- Validate `content` length ≤ 2000. Rate-limit. Audit-log every send (Task 08).

## Service management (§14.1 `ServiceManagement`)
Control the three units: `droptracker-core`, `droptracker-api`,
`droptracker-webhooks`.
```
GET  /api/v1/admin/services                      -> ServiceStatus[]
POST /api/v1/admin/services/{unit}               { "action": "start|stop|restart" } -> { ok }
GET  /api/v1/admin/services/{unit}/logs          -> { unit, lines: string[] }
```
`ServiceStatus` = `{ unit, name, status: running|stopped|failed|unknown, active, since }`.

**Implementation (mirrors the PHP controller):** the Web API invokes `systemctl`
on the backend host — via a local privileged helper script with a tight sudoers
entry, or an SSH tunnel to the host. Constraints:
- **Whitelist** the three unit names; reject anything else (no arbitrary unit
  control, no shell injection — never interpolate user input into a command).
- `logs` shells `journalctl -u {unit} -n {N} --no-pager` (capped N).
- Audit-log every start/stop/restart with the actor.
- Consider guarding `stop` with an extra confirmation flag, since stopping
  `droptracker-api` halts intake.

## Cross-content lookup (§14.1 `Lookup`)
```
GET /api/v1/admin/lookup?q=        (superadmin)  -> { results: AdminLookupResult[] }
```
`AdminLookupResult` = `{ category, id, label, detail?, href? }` where `category` ∈
`player|group|drop|clog|pb|ca|pet|item|npc`. Search across those entities by
name/id (optionally date-range/match-mode later). Cap results per category. Set
`href` to the public route when one exists (e.g. `/players/{id}`,`/groups/{id}`)
so the UI links through.

## Subscription tier management (replaces feature management)
Superadmin CRUD over the `subscription_tiers` table from Task 11.
```
GET    /api/v1/subscriptions/tiers                     (public; reused)
POST   /api/v1/admin/subscriptions/tiers               { SubscriptionTier }  -> { ok }
PATCH  /api/v1/admin/subscriptions/tiers/{key}         { SubscriptionTier }  -> { ok }
DELETE /api/v1/admin/subscriptions/tiers/{key}                               -> { ok }
```
- On create, also create the matching product/price at the payment provider (or
  store `provider_price_id`), since checkout (Task 11) needs it.
- Don't hard-delete a tier with active subscribers — soft-disable (`active=false`)
  instead, and the public tiers list already filters to active.
- Audit-log changes.

> **Note:** this is tier *definition* management, not the points/feature store —
> which is out of scope (see Task 11).

## Explicitly NOT ported (§9, §14.1)
- **SQL executor** (`Dashboard.php::actionSqlExec()`) — security anti-pattern.
  Do not implement an HTTP SQL endpoint. The front-end has no UI for it.

## Acceptance criteria
- `/me.is_superadmin` is accurate and every `/admin/*` endpoint enforces it
  (403 for non-staff).
- Discord send and service actions enqueue/execute correctly, are whitelisted,
  rate-limited, and audit-logged; no direct Discord connection from the Web API;
  no arbitrary unit/command execution.
- Lookup returns the typed result shape with working `href`s.
- Tier CRUD persists and reflects on `/premium`; tiers with active subscribers are
  soft-disabled, not deleted.
- No SQL-executor endpoint exists.
