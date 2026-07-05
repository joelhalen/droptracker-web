# Task 15 — Events schema v2 (engine foundation)

**Goal:** extend the Task-14 `web_*` events schema with everything the PRD v1
(`web/docs/events-prd.md`) requires: formation modes, verification flags, explicit
lifecycle, Discord config, completion/progress ledger, and the task library.
Schema + ORM + api-types only — no behavior in this slice.

**PRD refs:** §4 A1–A9, B1–B2, D3/D4/D7/D8/D9/D10; §8 implementation notes.

## Alembic migration

New revision `web18a_events_v2`, `down_revision = "web17a_badges"`, in
`disc/alembic/versions/web18a_events_v2.py` (follow the style of
`web14a_events.py` / `web17a_badges.py`).

### Alter `web_events` (add columns)

```
formation_mode        VARCHAR(16)  NOT NULL DEFAULT 'admin_assign'   -- self_join|auto_assign|admin_assign
requires_confirmation BOOL         NOT NULL DEFAULT 0                -- event-level force (D3)
join_code             VARCHAR(32)  NULL                              -- optional self-join code
discord_guild_id      VARCHAR(32)  NULL                              -- snowflake as string (D8)
board_size            INT          NOT NULL DEFAULT 5                -- 3..7, square (bingo)
bonus_line_points     INT          NOT NULL DEFAULT 0                -- bingo row/col/diag bonus
bonus_blackout_points INT          NOT NULL DEFAULT 0
activated_at          DATETIME     NULL                              -- explicit lifecycle (A5)
ended_at              DATETIME     NULL
```

`status` stays `draft|active|past` but becomes **authoritative** (set by explicit
activate/end actions or the scheduler sweep — Task 21), no longer derived from
dates at read time.

### Alter `web_event_tasks` (add columns)

```
requires_confirmation BOOL NOT NULL DEFAULT 0     -- per-task flag (D3)
config                TEXT NULL                   -- JSON: any_of/assembly item lists etc.
```

Extend `EVENT_TASK_TYPES` with `"custom"` (manual-confirmation-only type, D7/D3).
Existing 7 types unchanged.

### Alter `web_event_team_members` (add column)

```
joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP   -- credit cutoff (D10)
```

### New table `web_event_completions` — per-action ledger

Every qualifying submission or manual admin action is one row. Confirmation
status lives here; progress rollup lives in `web_event_progress`.

```
id               INT PK AUTO
event_id         INT NOT NULL FK web_events.id
task_id          INT NOT NULL FK web_event_tasks.id
team_id          INT NULL FK web_event_teams.id
player_id        INT NULL FK players.player_id
status           VARCHAR(16) NOT NULL       -- auto|pending|confirmed|rejected|manual|revoked
quantity         INT NOT NULL DEFAULT 1     -- contribution amount (items, kills, xp)
source_type      VARCHAR(16) NULL           -- drop|pb|clog|ca|experience|manual
source_id        BIGINT NULL                -- e.g. drops.drop_id
submission_guid  VARCHAR(64) NULL
proof_url        VARCHAR(255) NULL          -- image_url from the submission, if any
acted_by_user_id INT NULL                   -- admin for manual/confirmed/rejected/revoked
note             VARCHAR(255) NULL          -- admin note on manual actions
created_at / updated_at DATETIME
INDEX idx_web_evt_completion_event (event_id, status)
INDEX idx_web_evt_completion_task_team (task_id, team_id)
UNIQUE uq_web_evt_completion_src (task_id, team_id, submission_guid)   -- idempotency (NULL guid exempt)
```

### New table `web_event_progress` — rollup, one row per (task, team)

```
id            INT PK AUTO
event_id      INT NOT NULL FK web_events.id
task_id       INT NOT NULL FK web_event_tasks.id
team_id       INT NOT NULL FK web_event_teams.id
progress      INT NOT NULL DEFAULT 0        -- counted from non-pending, non-revoked ledger rows
completed     BOOL NOT NULL DEFAULT 0
completed_at  DATETIME NULL
UNIQUE uq_web_evt_progress (task_id, team_id)
INDEX idx_web_evt_progress_event (event_id)
```

### New table `web_event_channels` — per-event Discord destinations (D8)

```
id         INT PK AUTO
event_id   INT NOT NULL FK web_events.id
kind       VARCHAR(24) NOT NULL    -- announcements|completions|leaderboard|admin
channel_id VARCHAR(32) NOT NULL    -- snowflake string
UNIQUE uq_web_event_channel (event_id, kind)
```

### New table `web_event_task_library` — curated task presets

```
id             INT PK AUTO
name           VARCHAR(120) NOT NULL
description    TEXT NULL
type           VARCHAR(24) NOT NULL      -- EVENT_TASK_TYPES member
target         VARCHAR(120) NULL
target_value   INT NULL
default_points INT NOT NULL DEFAULT 0
difficulty     VARCHAR(24) NULL          -- air|water|earth|fire (legacy tiers) or free text
config         TEXT NULL                 -- JSON for any_of / assembly item lists
source         VARCHAR(24) NOT NULL DEFAULT 'legacy_v1'
active         BOOL NOT NULL DEFAULT 1
```

## Seed script (not in the migration)

`disc/scripts/seed_event_task_library.py`: parse
`disc/games/events/task_store/default.json` (~200 tasks; legacy types
`exact_item` → `item_collection`, `any_of`/`point_collection`/`assembly` →
`item_collection` with `config` JSON carrying the item list + semantics, or
`custom` where unmappable). Idempotent (upsert on name+source).

## ORM

Update `disc/db/models/events.py` with all of the above (new classes
`EventCompletion`, `EventProgress`, `EventChannel`, `EventTaskLibraryItem`);
export from `disc/db/models/__init__.py`.

## api-types

Extend `web/packages/api-types/src/index.ts`:
- `EVENT_TASK_TYPES` += `"custom"`; `EVENT_FORMATION_MODES = ["self_join","auto_assign","admin_assign"]`.
- `COMPLETION_STATUS = ["auto","pending","confirmed","rejected","manual","revoked"]`.
- `EventSummary`/`EventDetail`/`EventInput` gain: `formation_mode`,
  `requires_confirmation`, `board_size` (3–7, default 5), `discord_guild_id?`,
  `bonus_line_points`, `bonus_blackout_points`, `activated_at?`, `ended_at?`;
  `join_code` appears **only** in admin-facing detail, never public reads.
- `EventTask` gains `requires_confirmation`, `config?`.
- New: `EventCompletion`, `EventProgress`, `EventChannelConfig`,
  `EventTaskLibraryItem` zod schemas.

## Entitlements registry

Add `events_max_active` (int-kind field) to both entitlement registries
(`disc/web_api/entitlements_registry.py` + `web/packages/api-types/src/entitlements.ts`,
which need int-kind support added): number of concurrently active events per
group. Registry default: **1**. No schema change needed
(`subscription_tiers.entitlements` is JSON); the `/admin/tiers` editor renders
int fields as number inputs.

## Acceptance criteria

- `alembic upgrade head` applies cleanly on a copy of prod schema; `downgrade -1` reverses it.
- ORM models import and match the migration exactly (no `extend_existing` drift).
- Seed script populates `web_event_task_library` from the legacy JSON, idempotently.
- api-types build passes; existing Task-14 shapes remain backward-compatible
  (new fields additive with defaults).
- No behavior change to existing endpoints yet (they may ignore new columns).
