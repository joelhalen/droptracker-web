# Task 10 — Group management + creation wizard

**Goal:** back the group admin surfaces beyond config — members list, WOM sync,
hidden players, diagnostics — and the multi-step group-creation wizard.

**Plan refs:** FRONTEND_PLAN.md §6.2/§6.3, §9 (Group admin), §11, §14.1
(group dashboards, hidden players, diagnostics, creation wizard — Replace),
§20.1.

## Members & hidden players

### `GET /api/v1/groups/{groupId}/members?page=`  (session + group admin)
`GroupMembersPage` = `{ members: GroupMember[], meta: {page,limit,total} }` where
`GroupMember` = `{ id, name, group_rank?, total_loot?, hidden }`. Source from
`user_group_association` joined to `players`; `hidden` reflects the group's
`ignored_players` set; `total_loot` reuses the leaderboard Redis reads.

### `GET/PATCH /api/v1/groups/{groupId}/hidden-players`  (session + group admin)
Replaces the PHP `Groups::actionHiddenPlayers()`. The front-end PATCHes a single
toggle:
```json
PATCH { "player_id": 2001, "hidden": true }
```
Add/remove the player from the group's `ignored_players` config (the
`ignored_players` key referenced in §9/§11). `GET` returns the current set. Hidden
players are excluded from the group's leaderboards/board.

## WOM sync

### `POST /api/v1/groups/{groupId}/wom-sync`  (session + group admin)
Wraps the existing on-demand WOM membership sync (today authed via per-group
`export_api_key` — §2.2). Return `WomSyncResult`:
```json
{ "added": 3, "removed": 1, "total": 128, "synced_ts": 1719000000 }
```
**Never block the request on a slow WOM call beyond a sane timeout** (§15); if the
sync is long, run it in the background and return the last-known counts, or stream
status. Cache WOM responses briefly (the pattern exists in `group_create.py`).

## Diagnostics

### `GET /api/v1/groups/{groupId}/diagnostics`  (session + group admin)
Wraps `GET /groups/admin_diagnostics/{id}` (§2.2). Return `GroupDiagnostics`:
```json
{ "intake_healthy": true, "last_submission_ts": 1719000000,
  "members_synced_ts": 1718990000,
  "activity_7d": [ { "date": "2026-06-17", "submissions": 142 }, ... ],
  "warnings": [] }
```
`intake_healthy` = pipeline heartbeat; `activity_7d` = per-day submission counts
for the group over the last 7 days; `warnings` = human-readable issues
(e.g. "no drop_channel_id configured", "bot missing from guild").

## Group-creation wizard

The front-end wizard (`/groups/new`) calls three endpoints in sequence. All
require a session.

### `GET /api/v1/groups/wom-lookup/{womId}`
Wraps the existing wom-lookup (§2.2). Return `WomGroupPreview`:
```json
{ "wom_id": 1234, "name": "My Clan", "member_count": 84, "already_registered": false }
```
`already_registered` = a group with this `wom_id` already exists.

### `GET /api/v1/groups/guild-status/{guildId}`
Wraps the existing guild-status (§2.2). Return `GuildStatus`:
```json
{ "guild_id": "207...", "bot_present": true, "owns_group": false, "group_id": null }
```

### `POST /api/v1/groups`
Wraps `db.group_creation.create_web_group` (§2.2, §20.1) — **session auth, not
`XF_KEY`**. Body (`CreateGroupInputSchema`):
```json
{ "name": "My Clan", "wom_id": 1234, "guild_id": "207...", "discord_url": "https://discord.gg/…" }
```
On success return `{ "id": <newGroupId> }`. The endpoint must:
- Re-verify the WOM group isn't already registered and the guild doesn't already
  own a group (don't trust the client's earlier checks).
- Set the creating user as `owner` (seed `group_admins`, Task 08).
- Reuse all existing creation side-effects (config defaults, WOM seed, etc.) — do
  not fork `create_web_group`'s logic.

> **PHP parity / simplification (§7.1):** the old flow had a separate Discord
> OAuth step inside group creation (`Groups::actionCreateDiscordAuth/Callback`).
> With Discord OAuth now the primary sign-in (Task 02), the wizard reuses the
> existing session — no separate OAuth step. The `guilds` scope from sign-in lets
> you confirm the user manages the chosen guild.

## Authorization
- All management endpoints: owner/admin of `groupId` (re-checked server-side).
- Group creation: any signed-in user, but verify they manage the target guild
  (`MANAGE_GUILD`, from the cached `guilds` data) before creating.

## Acceptance criteria
- Members, hidden-players, WOM sync, and diagnostics endpoints return the exact
  contract shapes and enforce admin authorization.
- WOM sync and diagnostics never block the request path on slow upstreams beyond a
  timeout.
- The wizard endpoints drive `/groups/new` end-to-end; creating a group sets the
  caller as owner and is visible in their `/me` groups.
- Existing `create_web_group` behavior/side-effects are unchanged.
