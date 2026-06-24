# Task 13 — Native lootboard data

**Goal:** back the React-rendered lootboard with a live-loot JSON endpoint, and
keep the existing PNG generator available as a "share" affordance.

**Plan refs:** FRONTEND_PLAN.md §12 (Lootboards & Media), §6.3, §2.2.

## Why

The front-end now renders the lootboard natively in React (interactive tiles,
hover for qty/value, value-tier coloring) instead of round-tripping a generated
PNG. That needs the underlying data as JSON. The image generator stays as an
optional export.

## Contracts

### `GET /api/v1/groups/{groupId}/lootboard?period=`  (public, cached)
`period` ∈ `YYYYMM | YYYYWW | YYYYMMDD | all` (§6.5; see Task 07 for the partition
data). Return `Lootboard`:
```json
{ "group_id": 42, "period": "all",
  "total": { "value": 5123000000, "value_formatted": "5.1B" },
  "items": [
    { "item_id": 20997, "name": "Twisted bow", "quantity": 2,
      "value": { "value": 2200000000, "value_formatted": "2.2B" },
      "icon_url": "https://.../20997.png" } ] }
```
- `value` is the **total** for that row (unit value × quantity).
- `items` sorted by `value` desc; cap to a sane max (e.g. top 100) — the UI shows
  a grid.
- `icon_url` is optional; if you have item icons (OSRS cache/wiki), include them.
  The UI falls back to the item name when absent.
- Source from the group's per-item loot aggregates (the same data feeding the PNG
  generator) for the requested partition. Serve from Redis/short-TTL cache; never
  block on external calls.

### `POST /api/v1/groups/{groupId}/lootboard/generate`  (session optional)
Wraps the **existing** image generator (`generate-timeframe-board` /
`custom_board` / `board_update` — §2.2). Body `{ "period": "all" }`. Return
`{ "url": "https://.../board.png" }` (the existing public image path), or
`{ "url": null }` if generation is unavailable.
- This is the legacy subprocess/CLI path — keep it as-is; just wrap it. The plan
  treats native rendering as primary and the image as an export/share artifact.
- Consider rate-limiting / caching the generated image (it's a subprocess).

## Authorization
- The lootboard **read** is public (group pages are public).
- Image generation may be public too (it's a share button); rate-limit per group.
  If generation is expensive, gate it behind a session or cache aggressively.

## Acceptance criteria
- `GET /groups/{id}/lootboard` returns the `Lootboard` shape with the money
  envelope, sorted by value, for each supported `period`.
- The image generate endpoint returns a working URL (or null) and reuses the
  existing generator without changes to it.
- The web `/groups/{id}/lootboard` page (grid + period switcher + "Download
  image") works with `USE_MOCK_API=false`.
