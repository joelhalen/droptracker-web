# Task 22 — Legacy events: archive & decommission

**Goal:** retire the dead legacy event systems safely (D2: back up first — the
code may be useful reference later, especially for the Phase-C BoardGame mode).
**Run LAST**, only after Tasks 15–21 are verified in production.

**PRD refs:** §1.1, §4 cross-cutting, D1/D2.

## What goes

| Item | Detail |
|---|---|
| `disc/games/events/` | BoardGame system, ~2,300 lines, broken imports (`db.eventmodels` deleted) |
| `disc/eventBot.py` | Standalone event Discord bot, never launched by `real_startup.sh` |
| `disc/games/gielinor_race/` | In-memory race prototype; blueprint registered at `bots/main.py:65` |
| Legacy tables | `events`, `event_tasks`, `event_teams`, `event_participants`, `event_configurations`, `event_items`, `event_notifications`, `event_team_cooldowns`, `event_team_effects`, `event_team_inventory` (plus `bingo_boards`, `bingo_games`, `assigned_tasks`, `bingo_board_tiles` from migration 262385e9df48 if present) |

**What stays:** `group_point_events` / `GroupPointTimedEvent` (separate live
feature); `disc/games/events/task_store/default.json` content lives on inside
`web_event_task_library` (seeded in Task 15 — verify before deleting the JSON's
directory; keep a copy in the archive regardless).

## Steps

1. **Archive** (do all three, verify sizes/checksums):
   - `mysqldump` the legacy tables (schema + data) →
     `events_legacy_YYYYMMDD.sql`.
   - `tar czf legacy-events-code_YYYYMMDD.tgz disc/games/events disc/games/gielinor_race disc/eventBot.py`.
   - Store both under `/store/droptracker/archive/legacy-events/` (outside the
     app tree) and note the location in `disc/docs/` (one-line README pointing
     at the archive, so Phase-C work can find the BoardGame reference design).
2. **Pre-flight**: confirm the Task-15 library seed captured the task JSON
   (row counts vs `default.json` entries); grep the whole of `disc/` for
   remaining imports of `games.events`, `games.gielinor_race`, `eventBot`,
   `db.eventmodels` — the only expected hits are the files being deleted plus
   `bots/main.py:65`.
3. **Code removal**: delete the three code items; remove the
   `gielinor_race_bp` import + registration from `bots/main.py`; remove any
   startup-script references. Bot restart required.
4. **Table drop**: alembic migration `web19a_drop_legacy_events` (down_revision
   = current tip at merge time) dropping the legacy tables. `downgrade()` may
   recreate schema-only (data restore is from the dump; say so in the
   docstring).
5. **Post-check**: full bot + api restart cycle clean; no import errors in
   logs; `/events` web surface unaffected.

## Acceptance criteria

- Archive exists, is readable (test-restore the dump into a scratch schema),
  and its location is documented.
- No references to the deleted modules remain (CI grep clean); bot starts
  without the blueprint.
- Legacy tables gone from the live DB; alembic history linear.
- `group_point_events` untouched and its feature still works.
