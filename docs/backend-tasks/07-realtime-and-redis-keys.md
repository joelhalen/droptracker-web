# Task 07 — Realtime (SSE + Redis pub/sub) and Redis key canonicalization

**Goal:** stream live drops/leaderboard deltas/announcements to browsers, and fix
the divergent Redis leaderboard key schemes that block correct live + partitioned
leaderboards.

**Plan refs:** FRONTEND_PLAN.md §8 (all), §2.4 (substrate + warnings), §18.

## Part A — Canonicalize Redis leaderboard keys (prerequisite)

There are at least two group-leaderboard key shapes today (§2.4):
- `leaderboard:{partition}:group:{group_id}` (in `api/routes/groups.py`)
- `leaderboard:group:{group_id}:{partition}` (docs / `Player.get_score_at_npc`)

**Standardize on (§8.5):**
```
leaderboard:{YYYYMM}                          # global monthly
leaderboard:{YYYYMM}:group:{groupId}          # per-group monthly
leaderboard:{YYYYMM}:npc:{npcId}              # per-npc (global) monthly
leaderboard:{YYYYMM}:group:{groupId}:npc:{npcId}
leaderboard:{YYYYWW}:...                      # weekly variants
leaderboard:{YYYYMMDD}:...                    # daily variants
leaderboard:all:...                           # all-time variants
player:{playerId}:{YYYYMM}:total_loot
```
- Update **both** divergent reads to this scheme.
- Update the write path in `services/redis_updates.py` to maintain the chosen
  partitions. **Add daily (`YYYYMMDD`), weekly (`YYYYWW`), and all-time (`all`)**
  partitions so the API's `period` parameter (Task 04, §6.5) has real data — today
  only monthly exists.
- Add a `period -> partition` helper and reuse it in the Web API.
- **Migration/backfill:** decide whether to backfill historical partitions or
  start fresh. At minimum, write new partitions going forward; document the
  cutover. Add tests asserting reads and writes use identical keys.

> This is a backend-only change with no front-end coupling, but the live
> leaderboards and the daily/weekly/all-time filters depend on it. Do this first.

## Part B — Precompute group totals (perf, also unblocks Task 04)

`top_groups` recomputes over all groups per request (§2.2, §18). Maintain a
per-partition **group total** sorted set on each drop write (in
`redis_updates.py`): `ZINCRBY leaderboard:{partition}:groups {gp} {groupId}`. The
Web API then reads `/leaderboards/groups` like the player board.

## Part C — Publish events to Redis pub/sub (additive)

At the **exact points work already happens**, add publishes (no change to
processing semantics):
- In `services/redis_updates.py`, right after a leaderboard mutation → publish a
  `drop` / `leaderboard_delta` event.
- In the `NotificationService` drain loop (or on `notification_queue` write) →
  publish notable-submission events.
- On announcement publish (announcements feature) → publish `announcement`.

**Channels:** `rt:{scope}` where scope ∈ `global`, `group:{id}`, `player:{id}`,
`npc:{id}` (§8.5). Publish to every relevant scope for an event (e.g. a drop
publishes to `rt:global`, `rt:group:{g}`, `rt:player:{p}`, `rt:npc:{n}`).

**Event envelope (§8.3) — must match what the web client parses
(`RealtimeEventSchema`):**
```json
{ "v": 1, "type": "leaderboard_delta",
  "scope": "group:42", "ts": 1719000000,
  "data": { "id": 1337, "rank": 3, "delta": 2500000,
            "name": "Zezima", "total_loot_formatted": "123.5M" } }
```
`data` is type-specific and **already formatted for display** (the client renders
it directly). Keep payloads small; debounce/cap high-frequency deltas (§8.4, §18).

## Part D — SSE gateway

Expose:
```
GET /api/v1/stream?channels=global,group:42,player:1337     (text/event-stream)
```
- A lightweight async consumer SUBSCRIBEs to the requested `rt:{scope}` channels
  and relays matching events to the client as SSE `data:` frames.
- Filter strictly to the channels the client requested.
- Send periodic heartbeats/comments to keep the connection alive; support
  `Last-Event-ID` for resume if practical.
- The BFF proxies this at `/api/stream` and forwards the session cookie; you can
  treat it as internal. Auth: public scopes are anonymous; `player:{id}` private
  feeds should check the session.

> The web client is `apps/web/lib/use-event-stream.ts` (EventSource) and the BFF
> proxy is `apps/web/app/api/stream/route.ts`. Match the envelope and the
> `channels` query exactly.

## Acceptance criteria
- Reads and writes use one canonical key scheme; a test asserts parity; daily/
  weekly/all-time partitions are populated.
- `/leaderboards/groups` reads a precomputed sorted set (no full recompute).
- A real drop publishes a `leaderboard_delta` to the correct `rt:*` channels.
- `GET /api/v1/stream?channels=global` streams those events; the web leaderboard
  flashes/updates live with `USE_MOCK_API=false`.
- `/webhook` intake behavior and latency are unchanged (publishes are additive).
