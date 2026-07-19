# Loot Sweep — frontend contract

Backend for the `loot_sweep` event kind is **done** (see the backend repo
`docs/LOOT_SWEEP.md` for the full design + scoring math). This note is the
frontend to-do and the exact shapes to build against. **No UI ships yet.**

## What already works (no frontend code)

- **`/admin/event-types`** renders the "Loot Sweep" card (Enabled /
  Staff-testing-only / test-groups) like every other kind. It was 500ing only
  because `loot_sweep` wasn't in `EVENT_KINDS` — the Zod `AdminEventTypeSchema`
  (`key: z.enum(EVENT_KINDS)`) rejected the DB row. Fixed: `loot_sweep` is now
  in `EVENT_KINDS` and `EVENT_TASK_TYPES` in `packages/api-types/src/index.ts`.
- The create-form kind picker (`GET /events/meta/types`) is registry-driven, so
  Loot Sweep appears automatically once it's creatable (enabled, or the group is
  on its test-group allowlist).

## The task config to author (`type: "loot_sweep"`)

One task = one boss "set". The task form must write this `config` (the backend
validator snaps item names to canonical spellings, resolves `item_id`, and
rejects unknown items `422`):

```jsonc
{
  "kind": "loot_sweep",
  "decay_percent": 20,        // 0-100, points shed per repeat receipt
  "decay_mode": "linear",     // "linear" (grid: 100/80/60/40/20) | "geometric"
  "default_max_awards": 5,    // per-item cap unless overridden
  "set_bonus_points": 40,     // 0 = standalone items, no set bonus
  "set_bonus_max": 1,         // times a full set pays out per team
  "items": [
    { "item_name": "Armadyl helmet", "points": 9 },
    { "item_name": "Armadyl hilt",   "points": 13, "max_awards": 5 },
    { "item_name": "Pet kree'arra",  "points": 60, "counts_for_set": false }
  ]
}
```

`target` / `target_value` are unused for this type. Bounds (client-side mirror):
≤100 items, `points` 1–1,000,000, `max_awards` 1–100, `set_bonus_points`
0–10,000,000, `set_bonus_max` 1–100.

The authoring UI is the screenshot's grid: rows of `item id · points · name`,
a per-item cap, a `counts_for_set` toggle (off for extras like pets), and
set-level `set_bonus_points` / `set_bonus_max` / `decay_percent` / `decay_mode`.
Item-name autocomplete against the item DB. Reuse the existing task-create /
task-library endpoints (`api.*EventTask*`) — this is just a new `type` + config.

## Zod / types to add

- Add a `LootSweepConfig` Zod schema in `packages/api-types` and thread it into
  the task config union (alongside the item_collection kinds). Then
  `pnpm gen:api-types` is NOT needed (these are hand-authored schemas) — but run
  `pnpm typecheck && pnpm test` (contract test) after.
- `TASK_TYPE_LABELS` / `TASK_TYPE_HELP` in `apps/web/lib/events.ts` already have
  `loot_sweep` entries.

## Live board + realtime

- SSE scope `event:{id}` now emits a `loot_sweep` frame per scoring receipt:
  `{ kind:"loot_sweep", task_id, team_id, player_name, received_item,
     points /*delta*/, total /*team's set total*/, team_score, set_completed }`,
  and `{ kind:"revoke", loot_sweep:true, progress }` on revokes. Add these to
  `lib/use-event-stream.ts`'s validated frame union.
- The per-team decaying-cell grid (the screenshot) renders from per-item receipt
  counts. Either compute from the completions ledger, or ask backend for a new
  read endpoint — the backend already has
  `services/loot_sweep.py::score_counts()` returning the full per-item breakdown
  (`count`, `scored`, `points`, `max_awards`, `counts_for_set`) + set totals.
- The Discord board image (`services/event_board_image.py`) has no `loot_sweep`
  signature yet — that + a Loot-Sweep-aware `event_completion` layout are the
  remaining backend follow-ups when the UI is ready.
