# Task 08 — Data-model migrations

**Goal:** add the new tables/columns the web platform needs. These live in the
`data` DB; use the backend's Alembic setup.

**Plan refs:** FRONTEND_PLAN.md §13, §7 (sessions), §10 (announcements), §11
(audit).

## New tables

```sql
-- Only if using opaque (not stateless-JWT) sessions (Task 02).
web_sessions (
  id            PK,
  user_id       FK users.id,
  token_hash    -- store a hash, not the raw token
  created_at, expires_at,
  user_agent, ip, revoked BOOL
)

-- CSRF/nonce for the OAuth dance, IF not handled in Redis.
-- (The BFF currently signs its own state cookie, so this may be unnecessary;
--  add only if you move state server-side.)
oauth_states ( state PK, created_at, redirect )

-- Explicit web-granted admin rights beyond owner/MANAGE_GUILD (Task 02 roles).
group_admins (
  id PK,
  group_id FK groups.id,
  user_id  FK users.id,
  role ENUM('owner','admin'),
  granted_by FK users.id,
  created_at,
  UNIQUE(group_id, user_id)
)

-- Announcements (Phase 4 / §10). Add now so the schema is stable.
announcements (
  id PK,
  scope_type ENUM('global','group'),
  group_id FK groups.id NULL,
  author_user_id FK users.id,
  title, body_md TEXT,
  cover_image_url NULL,
  pinned BOOL DEFAULT 0,
  status ENUM('draft','published','archived') DEFAULT 'draft',
  published_at NULL,
  discord_message_id NULL, discord_channel_id NULL,  -- syndication refs (§10)
  created_at, updated_at,
  INDEX(scope_type, group_id, published_at)
)

-- Audit trail for config/admin actions (Task 05, §11, §15).
audit_log (
  id PK,
  actor_user_id FK users.id,
  group_id FK groups.id NULL,
  action,          -- e.g. 'config.update', 'settings.update'
  target,          -- e.g. 'group_configurations.notify_pets'
  before TEXT NULL, after TEXT NULL,
  created_at,
  INDEX(group_id, created_at)
)
```

## New columns on `users` (Task 03)

Add any preference columns that don't already exist:
- `dm_on_rank_change BOOL DEFAULT 0`
- `dm_on_points BOOL DEFAULT 0`
- `update_logs_opt_in BOOL DEFAULT 0`

(`public`, `hidden`, `global_ping`, `group_ping`, `never_ping`, `patreon_group`,
`premium_group` are described as already present in §2.3/§9 — verify and only add
the missing ones.)

## New config key (Task 05, §10, §13)

`group_configurations` is key/value, so no DDL — just start honoring:
- `announcements_channel_id` (and `seasonal_announcements_channel_id`).

These already exist in the shared registry
(`packages/api-types/src/group-config.ts`).

## `xf_user_id` (§7.4)
Do **not** drop it. Stop writing it for new users; retain for historical mapping.

## Seeding `group_admins` (§14.1)
On rollout, seed from existing group creators + users with `MANAGE_GUILD` on the
linked guild, so current owners keep admin access.

## Acceptance criteria
- Alembic migration(s) create the tables/columns above and run cleanly up/down on
  a copy of the `data` DB.
- Foreign keys and the listed indexes exist.
- A seed step populates `group_admins` for existing owners.
- No change to `xf_user_id` data.
