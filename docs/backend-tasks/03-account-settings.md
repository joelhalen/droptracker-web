# Task 03 — Account settings (`/me` reads & writes)

**Goal:** back the dashboard **Settings** page — notification/privacy/DM
preferences and Patreon/premium group selection.

**Plan refs:** FRONTEND_PLAN.md §9 ("Notification & privacy prefs"), §6.2, §6.3,
§14.1 (Account settings — Replace).

## Contract (see `AccountSettingsSchema`)

```jsonc
// GET /api/v1/me/settings   (session required)  -> 200
{
  "public": true,                // users.public / visibility
  "hidden": false,               // hidden from leaderboards
  "global_ping": true,           // users.global_ping
  "group_ping": true,            // users.group_ping
  "never_ping": false,           // users.never_ping
  "dm_on_rank_change": false,    // DM on rank change
  "dm_on_points": true,          // DM on points credit/debit
  "update_logs_opt_in": true,    // receive update logs
  "patreon_group": 101,          // users.patreon_group (nullable)
  "premium_group": 101           // users.premium_group (nullable)
}
```

```jsonc
// PATCH /api/v1/me            (session required)  -> 200 (returns full settings)
// Body: any SUBSET of the above keys. Apply only provided keys.
{ "never_ping": true, "patreon_group": null }
```

> The front-end sends only changed fields and expects the **full, updated**
> settings object back.

## Implementation notes

- Map each field to the corresponding `users` column. The plan enumerates the
  flags that exist today: `global_ping`, `group_ping`, `never_ping`, `public`,
  `hidden`, plus `patreon_group`, `premium_group` (§9, §11). Add columns via
  migration (Task 08) for any preference that doesn't yet exist
  (`dm_on_rank_change`, `dm_on_points`, `update_logs_opt_in`).
- **Validation:**
  - `patreon_group` / `premium_group` must be a group the user actually belongs
    to (check `user_group_association`), or `null`. Reject otherwise (422).
  - `never_ping` overrides `global_ping`/`group_ping` semantically — store as
    given; the bot already honors precedence. Don't silently rewrite.
- **Authorization:** operates on the session user only; no target-id needed.
- Write an `audit_log` row (Task 08) for settings changes if cheap; optional.

## PATCH `/me` vs other `/me` fields

The plan's §6.3 lists `PATCH /api/v1/me` as the single account-settings write
(privacy, pings, DM prefs, patreon/premium group). Keep this one endpoint for all
of the above. `GET /me/settings` is a convenience read so the form can load
without parsing the larger `/me` payload; you may instead embed settings in `/me`
and drop `/me/settings` — if you do, tell the web side so the client switches.

## Acceptance criteria
- `GET /api/v1/me/settings` returns the exact shape for the session user.
- `PATCH /api/v1/me` with a partial body updates only those fields and returns
  the full updated settings.
- Selecting a `patreon_group`/`premium_group` the user is not in is rejected.
- The web `/settings` page round-trips against the real API with
  `USE_MOCK_API=false`.
