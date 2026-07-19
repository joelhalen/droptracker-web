# Loot Sweep — frontend

The `loot_sweep` event kind is implemented end-to-end. Backend design + scoring
math live in the backend repo `docs/LOOT_SWEEP.md`.

## What's built

- **Admin toggle card** — `/admin/event-types` renders the "Loot Sweep" card
  (Enabled / Staff-testing-only / test-groups) like every kind. (It was 500ing
  only because `loot_sweep` wasn't in `EVENT_KINDS` — the Zod
  `AdminEventTypeSchema.key` enum rejected the row; fixed.)
- **Kind picker** — `GET /events/meta/types` is registry-driven, so Loot Sweep
  appears in the create form automatically once creatable.
- **Authoring editor** — `components/loot-sweep-editor.tsx`, wired into
  `event-task-form.tsx` for `type: "loot_sweep"`. One task = one boss "set":
  item search (exact names, validated server-side), per-item **points** /
  **max receipts** / **in-set** toggle with a live **decay preview**
  (`9 · 7 · 5 · 4 · 2`), and set-level **full-set bonus** / **bonus max** /
  **decay %** / **decay curve**. Serializes to the `config` via
  `lootSweepToConfig`; the flat "Points" field is hidden (scoring is per-item).
- **Live board** — `components/loot-sweep-board.tsx`, rendered on the event page
  for `kind === "loot_sweep"` (replaces the flat Tasks list). An icon-first
  "collection race": per set, each team gets a strip of the boss's item icons —
  **greyed-out until obtained, full colour once received**, with a **×count**
  badge and **scored/cap pips** — plus a full-set ✓ badge and the running set
  total, ranked, viewer's team highlighted. Refetches on the event SSE scope.

## Shapes / types (`packages/api-types`)

- `LootSweepConfigSchema` / `LootSweepConfigItemSchema` — the task config.
- `LootSweepBoardSchema` (+ `LootSweepSet`, team/item rows) —
  `GET /events/{id}/loot-sweep`, exposed as `api.eventLootSweep(id)` and the
  `fetchEventLootSweep` server action. `sets[].items` is config order;
  `sets[].teams[].items` is same-indexed `{count, scored, points}`.
- `lib/loot-sweep.ts` — decay math (`receiptPoints` / `decaySequence` /
  `itemTotal`), a faithful mirror of `services/loot_sweep.py`. Keep in sync.

## Remaining (backend, when wanted)

- Discord board **image** for `loot_sweep` (`services/event_board_image.py` has
  no signature for it yet).
- A Loot-Sweep-aware Discord `event_completion` layout (today it reuses the
  generic one with `loot_sweep` / `points_based` markers).
