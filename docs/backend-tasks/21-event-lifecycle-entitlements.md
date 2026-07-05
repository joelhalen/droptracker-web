# Task 21 — Event lifecycle, entitlements & global events

**Goal:** explicit activate/end, tier-limited concurrency, scheduled
transitions, and superadmin global events. Depends on Task 15 (Tasks 16/17/20
consume its rules).

**PRD refs:** §4 A5/A8/A9, D5/D6/D9; §7.1 (base events tier = 1 active event).

## Lifecycle

States: `draft -> active -> past` (one-way; no reactivation in v1).

```
POST /api/v1/events/{id}/activate   -> EventDetail
POST /api/v1/events/{id}/end        -> EventDetail
```

**activate** (event admin):
1. Validations: ≥1 team; if `has_bingo`, board passes Task-20 validation; event
   not `past`; `ends_at` (if set) in the future.
2. **Concurrency (D9):** for group events, count the group's `active` events;
   compare against the `events_max_active` entitlement of the group's tier
   (resolve via `web_api/entitlements.py::resolve_group_entitlements`; default
   1; missing entitlement → treat as tier lacking events → 403). At limit →
   409 with a clear message. Global events (superadmin) skip the check.
3. Effects: `status='active'`, `activated_at=now`; if `starts_at` null, set it
   to now; insert free-cell completions for all teams (Task 20); add event id
   to the Redis `events:active` set (Task 17 gate); enqueue `event_started`
   notification; publish SSE `event_update {kind:"started"}`; audit
   `event.activate`.

**end** (event admin): `status='past'`, `ended_at=now`, remove from
`events:active`, enqueue `event_ended` (with final standings in data), SSE
`{kind:"ended"}`, audit `event.end`.

**Scheduler sweep:** in `workers/event_consumer.py` (Task 17), a 60s tick:
activate `draft` events whose `starts_at` has passed **only if** they pass the
same validations (log + notify admin channel on failure instead of silently
skipping), and end `active` events whose `ends_at` has passed. Reuse the same
service functions as the routes (`services/event_engine.py`) — one code path.

## Global events (D6)

- `group_id NULL`; **create/manage: superadmin only** (`users.is_superadmin`).
- Entitlement + concurrency checks bypassed; membership eligibility = any
  player linked to the session user (Task 16 already specifies this).
- `/admin` (superadmin dashboard) gains an Events section: list all events
  (any group + global), create global event, and jump into the standard event
  manager UI for any event (superadmin already bypasses group checks).
- Public `/events` index: global events listed for everyone; group events
  shown as today.

## Entitlement plumbing

- `_assert_event_admin` (web_api/routes/events.py) extended: `group_id NULL` →
  require superadmin; else current behavior. All new event routes
  (Tasks 16/18/19/20) use it.
- Frontend `assertEventsEntitlement` server-action guard mirrors this.
- Draft creation stays unlimited; the limit binds at activation only.

## Frontend

- Event manager: Activate button (with pre-flight validation results shown) and
  End button (confirm dialog); status chip reflects explicit state; countdown
  to scheduled start/end.
- `/admin` events section per above (reuse existing admin table patterns).
- Group events page shows "active events X/Y (tier limit)".

## Acceptance criteria

- Activation enforces validations + tier concurrency (409 at limit; superadmin
  global bypass verified).
- Scheduled sweep activates/ends on time through the same service functions;
  failed scheduled activation notifies the admin channel.
- `events:active` Redis set always mirrors DB active events (sweep reconciles).
- Engine ignores submissions for non-active events even if queued late.
- All transitions audit-logged and posted to Discord (with Task 19).
- Superadmin can create and run a global event end-to-end.
