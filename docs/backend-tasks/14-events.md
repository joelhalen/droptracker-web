# Task 14 — Events system

**Goal:** back the events feature — events with typed tasks, teams, and optional
bingo boards. This is the largest remaining entity surface (FRONTEND_PLAN.md
Phase 6).

**Plan refs:** FRONTEND_PLAN.md §6.1/§6.3, §9 (Events), §14.1 (`/Events/` —
Migrate, Phase 6), §20.5.

## Scope of this slice

The PHP `/Events/` package is entity-heavy (events, tasks with 7 types, teams,
bingo, effects, cooldowns, shop items — §20.5). The front-end currently consumes
a **focused subset**: event listing/detail, tasks, teams (with scores), and a
read-only bingo board. Effects/cooldowns/shop and live scoring automation can
follow; design the schema to allow them but they aren't required for the current
UI.

## Data model (Alembic, Task 08 style)

```
events ( id PK, group_id FK groups.id NULL, name, description TEXT,
         status ENUM('draft','active','past'),
         starts_at, ends_at, has_bingo BOOL, created_at, updated_at )
event_tasks ( id PK, event_id FK, type ENUM(<7 types>), label,
              target, target_value INT NULL, points INT DEFAULT 0 )
event_teams ( id PK, event_id FK, name, score INT DEFAULT 0 )
event_team_members ( team_id FK, player_id FK, PRIMARY KEY(team_id, player_id) )
event_bingo_cells ( id PK, event_id FK, idx INT, label, task_id FK NULL )
event_bingo_completions ( cell_id FK, team_id FK NULL, player_id FK NULL )
```
The 7 task `type`s (must match `EVENT_TASK_TYPES`): `item_collection`,
`kc_target`, `xp_target`, `ehp_target`, `ehb_target`, `pb_target`,
`skill_target`. `target_value` is interpreted per type (kc, xp, level, seconds…).

## Contracts

### Public reads
```
GET /api/v1/events?groupId=&status=active|past      -> EventSummary[]
GET /api/v1/events/{id}                              -> EventDetail
```
`EventSummary` = `{ id, group_id, name, description?, status, starts_at, ends_at,
has_bingo }`. `EventDetail` extends it with:
```json
{ "tasks": [ { "id": 11, "type": "kc_target", "label": "Vorkath 50 KC",
              "target": "Vorkath", "target_value": 50, "points": 10 } ],
  "teams": [ { "id": 21, "name": "Team Red", "score": 120, "member_count": 8 } ],
  "bingo": { "size": 5, "cells": [ { "index": 0, "label": "Twisted bow",
              "task_id": null, "completed_by": ["Team Red"] } ] } }
```
- Only non-draft events are public (drafts visible to group admins only).
- `bingo` is `null` when `has_bingo` is false.
- `completed_by` holds team (or player) names for display.

> The plan (§6.1) also lists `/events/{id}/teams` and `/events/{id}/bingo` as
> separate endpoints. Folding them into `EventDetail` is fine for the current UI;
> add the split endpoints only if you need independent caching.

### Admin writes (session + group admin of `events.group_id`)
```
POST   /api/v1/events                      { EventInput }       -> { id }
PATCH  /api/v1/events/{id}                  { partial }          -> EventDetail
POST   /api/v1/events/{id}/tasks            { EventTaskInput }   -> { id }
DELETE /api/v1/events/{id}/tasks/{taskId}                        -> { ok }
POST   /api/v1/events/{id}/teams            { EventTeamInput }   -> { id }
```
- `EventInput` = `{ group_id, name, description?, starts_at?, ends_at? }`
  (timestamps are unix seconds or null).
- `EventTaskInput` = `{ type, label, target?, target_value?, points }`; validate
  `type` ∈ the 7 types.
- `EventTeamInput` = `{ name }`.
- Authorization: owner/admin of `events.group_id`, re-checked server-side.

## Scoring (backend-owned)

Team/cell scoring should be driven by the **submission pipeline**, not the web
API: when a drop/KC/XP/PB/level event is processed, evaluate matching active
event tasks and increment `event_teams.score` / mark bingo completions. The web
API only reads the computed scores and exposes admin CRUD. Keep this in the
backend services layer (consistent with §10.2 "processors own side-effects").
Emitting a realtime `submission`/event update (Task 07) lets open event pages
update live — optional for this slice.

## Acceptance criteria
- Listing/detail return the exact `EventSummary`/`EventDetail` shapes; drafts are
  hidden from public reads.
- Task/team CRUD enforces group-admin authorization and validates task types.
- Scores are computed by the backend pipeline, not trusted from the client.
- The web `/events`, `/events/{id}`, and `/groups/{id}/events*` pages work with
  `USE_MOCK_API=false`.
- Effects/cooldowns/shop and bingo *designer* are out of scope for this slice
  (schema should not preclude them).
