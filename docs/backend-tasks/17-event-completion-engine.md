# Task 17 — Event completion engine (async worker)

**Goal:** the missing core — consume processed submissions and turn them into
task progress, completions, team points, bingo cells, realtime updates, and
notification-queue entries. Depends on Task 15; pairs with Task 16 (membership
provides participants).

**PRD refs:** §4 A2/A3/A7, D3/D7/D10; §8 (hot-path constraint).

## Architecture

```
data/submissions/*.py  --(LPUSH events:submissions, fire-and-forget)-->  Redis
workers/event_consumer.py  --(BRPOP)-->  evaluate -->  MySQL web_event_*  
                                                   -->  PUBLISH rt:event:{id}
                                                   -->  INSERT notification_queue
```

### Producer hook (tiny, hot-path-safe)

At the existing **post-acceptance** point of each processor (after the DB row is
created and `redis_updates` is called — e.g. `data/submissions/drop.py` ~line
345), `LPUSH events:submissions <json>` via the existing `RedisClient`
(`utils/redis.py`). One O(1) Redis call, no queries, wrapped in try/except so a
Redis hiccup can never fail a submission. Envelope:

```json
{ "v": 1, "kind": "drop|pb|clog|ca|experience",
  "guid": "...", "player_id": 123, "ts": 1751600000,
  "data": { …type-specific… } }
```

Type-specific fields (all already available at the hook points):
- drop: `item_id, item_name, npc_id, npc_name, value, quantity, total_value, kill_count, image_url, source_id (drop_id)`
- pb: `npc_name, time_ms (or ticks), team_size, kill_time_formatted, image_url`
- clog: `item_name, item_id, kc, npc_name, image_url`
- ca: `task_name, tier, image_url`
- experience: `skill, xp, level` (as reported)

**Gate the LPUSH** on a cheap Redis flag `events:active` (a set of active event
ids maintained by the worker/lifecycle code). If empty/absent, skip the push —
zero overhead when no events run. Skip `world_type != "main"` submissions (v1).

### Consumer: `workers/event_consumer.py`

Follow the `workers/webhook_consumer.py` pattern (async loop, `BRPOP
events:submissions 5`, per-item DB session, try/except/finally, structured
logging via `db/app_logger.py`). Launched by `real_startup.sh` as screen
`DT-events` (add alongside `DT-consumer`).

In-memory matcher state, refreshed every 30s (and on a `rt:event-admin` bump
message published by web_api on event/task/roster mutations):
`{ player_id -> [(event_id, team_id, joined_at)] }` for **active** events only,
plus each active event's tasks/cells. Keeps per-submission handling query-free
until a match is found.

### Evaluation rules (v1 — D7: completion is the primitive, points optional)

For each envelope × each active event the player participates in
(`joined_at <= ts` and `ts` within the event window — D10, A5):

| task type | matches | progress unit | complete when |
|---|---|---|---|
| `item_collection` | drop or clog whose item matches `target` (name, case-insensitive; `config.any_of` list ok) | quantity | progress ≥ max(target_value, 1) |
| `kc_target` | drop from NPC matching `target` (each qualifying kill counts once — dedupe by (npc, kill_count) per player) | 1 per kill | progress ≥ target_value |
| `pb_target` | pb for `target` boss with time ≤ `target_value` seconds | n/a | first match |
| `xp_target` | experience in skill `target`; progress = xp gained since first report after join (per-player baseline in Redis `events:{eid}:xpbase:{pid}:{skill}`) | xp delta | progress ≥ target_value |
| `skill_target` | experience/level report for skill `target` with level ≥ `target_value` | n/a | first match |
| `ehp_target`/`ehb_target`/`custom` | **not auto-evaluated in v1** — manual/confirmation only (Task 18) | — | — |

On a match:
1. Insert `web_event_completions` ledger row — `status = 'pending'` if the task
   or event has `requires_confirmation`, else `'auto'`. **Added post-spec:** the
   event's `submission_policy` is applied first (envelope `used_api` flag) —
   `api_only` skips non-plugin submissions entirely; `confirm_non_api` forces
   `'pending'` for them (Task 18). Idempotent via
   `uq_web_evt_completion_src (task_id, team_id, submission_guid)` — insert
   ignore on duplicate.
2. If not pending: fold into `web_event_progress` (upsert, add quantity, set
   `completed/completed_at` when threshold crossed — once completed, further
   ledger rows still record but don't re-complete).
3. On completion: add `task.points` to `web_event_teams.score` (0-point tasks
   change nothing); if the task backs bingo cells, insert
   `web_event_bingo_completions` (cell_id, team_id) once per team, then evaluate
   line/blackout bonuses (Task 20 defines them; guard with `has_bingo`).
4. Publish `rt:event:{event_id}` (see `services/realtime.py` envelope style):
   `{v:1, type:"event_update", scope:"event:{id}", ts, data:{kind:
   "progress|completion|cell|pending", task_id, team_id, cell_idx?, points?,
   team_score?, player_name?}}`.
5. Insert `notification_queue` row (`create_notification` in
   `data/submissions/common.py` style) with type `event_completion` /
   `event_pending` and the event_id in data — sent by Task 19.

Confirmation flow (Task 18) reuses steps 2–5 when a pending row is confirmed.

### Realtime scope

Add `event:{id}` to the allowed public scopes in
`web_api/routes/realtime.py::_authorize_channels()` (public like `group:*`).

## Testing

- Unit-test the matcher (pure functions: envelope × task → match/progress) in
  `disc/tests/` per existing pytest layout.
- Integration: seed an active event + membership, LPUSH synthetic envelopes,
  assert ledger/progress/score/bingo rows; duplicate GUID pushes are no-ops.

## Acceptance criteria

- Intake hot path gains only a guarded LPUSH (no queries); Redis outage cannot
  fail submissions.
- Joined-after / window / world-type rules enforced (D10).
- Ledger idempotent under replay; re-running the consumer over the same queue
  entries produces no duplicates.
- Pending vs auto statuses honor per-task and per-event `requires_confirmation`.
- Team score and bingo completions update; SSE frames arrive on
  `/api/v1/stream?channels=event:{id}`; notification rows appear.
- Worker added to `real_startup.sh` and survives restart with no in-flight loss
  (BRPOP + idempotent ledger).
