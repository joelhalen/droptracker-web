# Task 05 — Typed group-config endpoints

**Goal:** back the group admin **Settings** editor with a typed
`GET`/`PATCH /api/v1/groups/{id}/config` that reads/writes `group_configurations`
with validation — replacing the loosely-typed `load_config` for the web while
keeping `load_config` intact for the RuneLite plugin.

**Plan refs:** FRONTEND_PLAN.md §11 (all), §6.3, §14.1 (Group config — Replace).

## The registry is shared — use it verbatim

The 55+ keys, their types, defaults, and which keys have `seasonal_` mirrors are
defined once in the web repo at
**`packages/api-types/src/group-config.ts`** (`GROUP_CONFIG_FIELDS`,
`allConfigKeys()`, `getConfigField()`).

Mirror this on the backend as the **single validation authority**. Two acceptable
approaches:
1. **Port** the registry to a Python module (e.g. `web_api/config_registry.py`)
   with the same keys/types/defaults. Add a test asserting the Python key set ==
   the TS `allConfigKeys()` (e.g. export the TS list to JSON in CI and diff).
2. **Vendor** the JSON: have the web repo emit `group-config.json` and load it in
   Python. Less duplication; preferred if your build can consume it.

> ⚠️ Note the intentional edge case: `seasonal_boards` is a **real base key** that
> starts with `seasonal_` and is **not** a mirror. Resolve exact keys before
> stripping the `seasonal_` prefix (the TS `getConfigField` does this).

## Contracts

### `GET /api/v1/groups/{groupId}/config`  (session + group admin)
Return a flat object of **all** keys → current value, falling back to each field's
registry default when unset:
```json
{ "drop_channel_id": "123...", "minimum_value_to_notify": 100000,
  "notify_pets": true, "loot_board_type": "1", "seasonal_boards": false, ... }
```
Types must match the registry (booleans as JSON booleans, ints as numbers,
channels/strings as strings). `group_configurations` stores everything as text
today — **coerce** to the registry type on read.

### `PATCH /api/v1/groups/{groupId}/config`  (session + group admin)
Body: a **subset** of keys (only changed ones). For each:
1. Resolve the field via the registry; reject unknown keys (422).
2. Validate against the field type/min/max/options.
3. Upsert into `group_configurations` (coerce to text for storage).
4. Write an `audit_log` row (Task 08): actor, group, key, before, after.
Return `204` or `{ "ok": true }`.

Seasonal mirror writes use the `seasonal_`-prefixed key and validate against the
**base** field's type.

## Authorization
- `current_user()` must hold `owner`/`admin` on `{groupId}` (Task 02 role
  derivation). Re-check server-side; the UI hiding controls is not sufficient.
- `export_api_key` is sensitive: never return it in `GET` to non-admins (admins
  only), and treat writes carefully (regenerate vs. set).

## Keep `load_config` for the plugin (§11.2)
Do **not** change `GET /load_config` (plugin-facing). The new typed endpoints are
additive. Both read the same `group_configurations` table.

## Channel pickers (future)
The editor will later populate channel dropdowns from the group's Discord guild
(§11.2). Plan a `GET /api/v1/groups/{groupId}/channels` (bot-sourced, cached) as a
follow-up; not required for this task (the UI accepts raw channel ids today).

## Acceptance criteria
- Backend key set == TS `allConfigKeys()` (tested).
- `GET` returns all keys typed per the registry with defaults applied.
- `PATCH` validates, upserts only provided keys, writes audit rows, and rejects
  unknown/invalid keys and non-admins (403/422).
- `load_config` behavior is unchanged.
- The web `/groups/{id}/settings` editor round-trips with `USE_MOCK_API=false`.
