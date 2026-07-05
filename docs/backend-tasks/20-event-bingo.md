# Task 20 — Bingo designer + live board

**Goal:** the first full game mode (D1): admins design an N×N bingo board bound
to tasks; the engine (Task 17) completes cells; the public board is live.
Depends on Tasks 15 + 17 (+18 for manual cell handling).

**PRD refs:** §4 B1–B5; board sizes DECIDED: 3×3 | 4×4 | **5×5 (default)** |
6×6 | 7×7, square only.

## Designer semantics

- Board exists when `web_events.has_bingo = true`; `board_size` ∈ {3,4,5,6,7}.
- Each cell (`idx` 0..size²−1) is one of:
  - **task cell** — bound to an event task (`task_id`). The designer can create
    that task inline from a library preset (`web_event_task_library`) or from
    scratch; a library pick copies the preset into `web_event_tasks` (points
    default from `default_points`, editable).
  - **free cell** — label only, `task_id` null; counts as completed for every
    team from activation (auto-inserted completions at activation).
- Bonuses (D7-compatible, optional): `bonus_line_points` per completed
  row/column/diagonal, `bonus_blackout_points` for the full board; 0 disables.
- The board is **editable only while `draft`**; activation (Task 21) locks it.
  Activation validation: every non-free cell bound to a task; size matches
  cell count.

## Contracts (event admin)

```
PUT /api/v1/events/{id}/bingo
    { size, cells: [ { idx, label, task_id? , library_item_id?,
                       new_task?: EventTaskInput } ] }        -> EventDetail.bingo
GET /api/v1/event-task-library?query=&type=&page=            -> EventTaskLibraryItem[]
```

- `PUT` replaces the whole board (simplest; drafts only, 409 once active).
  For each cell exactly one of `task_id` / `library_item_id` / `new_task` /
  nothing (free cell). Creates tasks as needed, deletes orphaned auto-created
  tasks no longer referenced.
- Library route is public-read for event admins (session + any group admin);
  supports name search and type filter.

## Engine additions (extends Task 17 step 3)

- On task completion for a team: complete every cell bound to that task
  (`web_event_bingo_completions` unique per (cell, team)).
- After each new cell completion, evaluate lines: any row/col/diagonal newly
  all-completed → award `bonus_line_points` to the team **once per line**
  (ledger row with `source_type='manual'`? No — use a dedicated
  `source_type='bonus'`, `task_id` of the triggering task, note `line:r3`);
  full board → `bonus_blackout_points` once. Track awarded lines in Redis or
  derive idempotently from ledger notes.
- SSE: cell/line/blackout frames on `rt:event:{id}` (Task 17 envelope);
  notifications `event_cell` / `event_line` / `event_blackout` (Task 19).

## Frontend

- **Designer** (admin manager, new Board tab): size picker (default 5×5 —
  changing size re-grids and truncates with confirmation), click-a-cell editor
  with library search picker (type/difficulty filters), custom task form, free
  cell toggle, bonus point fields; save = one PUT. Locked state once active
  (read-only with a notice).
- **Public board** (`components/bingo-board.tsx` upgrade): per-team completion
  overlay (team selector or all-teams color dots), live updates via
  `useEventStream(["event:{id}"])`, cell detail popover (task, who completed
  it, when, proof link if viewer is admin).

## Acceptance criteria

- Boards of all five sizes round-trip through the designer; non-square or
  out-of-range sizes rejected.
- Library picker creates properly-typed tasks; free cells complete for all
  teams at activation.
- Line/blackout bonuses award exactly once per team per line, survive revoke
  recomputation (Task 18), and post notifications.
- Board edits after activation are rejected (409) in API and disabled in UI.
- Public board updates live during a simulated event with `USE_MOCK_API=false`.
