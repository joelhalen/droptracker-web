# Task 18 — Verification queue & manual admin actions

**Goal:** the human layer over the engine — approve/reject pending completions,
manually award or revoke anything, with audit. Depends on Tasks 15 + 17.

**PRD refs:** §4 A4/B4, D3, D10 (manual award is the retro-credit escape hatch).

## Contracts (event admin auth; superadmin for global events)

```
GET    /api/v1/events/{id}/completions?status=pending|all&teamId=&taskId=
       -> EventCompletion[] (each with task label, team name, player name,
          quantity, source_type, proof_url, submission_guid, created_at)

POST   /api/v1/events/{id}/completions/{completionId}/confirm  -> { ok }
POST   /api/v1/events/{id}/completions/{completionId}/reject   { note? } -> { ok }

POST   /api/v1/events/{id}/award    { task_id, team_id, quantity?, note? } -> { id }
POST   /api/v1/events/{id}/revoke   { completion_id, note? }               -> { ok }
```

Semantics:
- **confirm**: `pending -> confirmed`, then apply engine steps 2–5 of Task 17
  (progress fold, points, bingo, SSE, notification). Reuse the engine's apply
  function from a shared module (e.g. `services/event_engine.py`) — web_api and
  worker must not duplicate the logic.
- **reject**: `pending -> rejected`; no side effects; note stored.
- **award**: inserts a `manual` ledger row (acted_by, note) and applies effects
  immediately — this is how admins grant pre-join credit (D10) and complete
  `custom`/`ehp_target`/`ehb_target` tasks.
- **revoke**: target row -> `revoked`; recompute the affected
  `web_event_progress` row from surviving ledger rows; if completion state or
  points changed, adjust team score and remove the team's bingo completion for
  affected cells (and any line/blackout bonus deltas); publish SSE correction.
- Every action writes an `AuditLog` row (pattern:
  `web_api/routes/config.py::_audit`): actions `event.completion.confirm`,
  `.reject`, `event.award`, `event.revoke`, with before/after JSON.
- Toggles: `requires_confirmation` editable per event (PATCH /events/{id}) and
  per task (new `PATCH /api/v1/events/{id}/tasks/{taskId}` accepting
  `requires_confirmation`, `points`, `label`, `target`, `target_value`).
- Per-event `submission_policy` (added post-spec, migration `web26a`) gates
  credit by intake path: `all` (default — everything counts), `confirm_non_api`
  (non-plugin submissions always land as `pending` completions), `api_only`
  (submissions without the plugin API flag are ignored). Returned on event
  summary/detail; accepted by POST /events and PATCH /events/{id} (422 on any
  other value).

## Frontend

- Admin event manager gains a **Review** tab:
  - Pending list: proof image (proof_url), task, team, player, quantity, time;
    confirm/reject buttons; batch confirm.
  - Full ledger view with status filter; revoke on confirmed/auto/manual rows.
  - Manual award form: task picker (event tasks), team picker, quantity, note.
- Event settings: event-level `requires_confirmation` switch; per-task switch in
  the task list; three-option `submission_policy` select with per-mode help text.
- Pending count badge on the manager nav (from `GET ...?status=pending`).

## Acceptance criteria

- Confirm applies identical effects to an auto completion (single shared code
  path with the worker — asserted by an integration test).
- Revoke fully unwinds progress/points/bingo including bonuses; SSE reflects it.
- All four actions audit-logged with actor and before/after.
- Non-admins get 403 on every route; UI hidden without entitlement.
- Works end-to-end with `USE_MOCK_API=false`.
