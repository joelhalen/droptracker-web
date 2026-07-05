# DropTracker Events System — PRD (v1, 2026-07-04)

> Status: **decided — ready to refine into implementation tasks.** Section 6 records the
> product decisions made on 2026-07-04; only the minor items in Section 7 remain open, and
> each has a stated default that implementation may use unless overridden.
> Section 1 (current state) is verified against the live codebase and database as of 2026-07-04.

---

## 1. Current State (code + DB audit, 2026-07-04)

### 1.1 Three disconnected event systems coexist

| System | Location | Status |
|---|---|---|
| **Legacy BoardGame / bingo** | `disc/games/events/` (~2,300 lines), `disc/eventBot.py` (713 lines), unprefixed `events` / `event_*` DB tables (10 tables) | **Dead.** Not in `real_startup.sh`; every module imports `db.eventmodels`, which was deleted in a refactor (commit 293c18b) — the whole package crashes on import. Last touched Mar 2025. |
| **Gielinor Race** | `disc/games/gielinor_race/` | **Half-built.** Its blueprint *is* registered in `bots/main.py:65`, but state is a module-level in-memory dict — no DB persistence, no game loop. Loses everything on restart. |
| **Web events (Phase 6 slice)** | `disc/db/models/events.py` (`web_events` + 5 child tables), `disc/web_api/routes/events.py` (7 endpoints), Next.js pages under `apps/web/app/(public)/events` and `(admin)/groups/[id]/events` | **Live but shallow.** Clean, spec-driven (`web/docs/backend-tasks/14-events.md`), ORM-mapped, auth + entitlement-gated, mock-fallback wired. All tables are **empty** — never used in production. |

A fourth, unrelated system — `group_point_events` (`GroupPointTimedEvent`) — provides
time-windowed point multipliers (e.g. "3× points for d legs"). It is functional, in use
(1 live row), and **stays a separate feature** outside this PRD.

### 1.2 What the web slice can and cannot do today

Works (per spec, verified):
- Create/edit events (name, description, start/end), draft→active→past status derived from dates.
- Add/delete typed tasks (`item_collection`, `kc_target`, `xp_target`, `ehp_target`, `ehb_target`, `pb_target`, `skill_target`) with label/target/points.
- Create teams (name only). Public event list + detail pages; read-only bingo board renderer.
- Group-admin authorization on all writes; `events` subscription-tier gating; draft visibility rules.

Missing (explicitly deferred by the 14-events spec):
- **No team-member assignment** — API and UI absent; `web_event_team_members` can never be populated.
- **No bingo designer** — `web_event_bingo_cells` can never be populated; `has_bingo` is decorative.
- **No scoring/completion engine.** The spec says "scores are computed by the submission
  pipeline" — but **no such pipeline code exists**. Nothing in `disc/data/submissions/`
  reads or writes any event table.

**Net: the current web slice is a hollow shell — a well-built CRUD layer around an engine
that was never written.**

### 1.3 Plugin side

The RuneLite plugin has **no community-event surface** and needs none for v1. Its
`events/` package is in-game trigger handlers (drops, PBs, collection log, CAs, XP,
quests, pets) submitted via `POST /webhook`; submissions already carry item/npc/value/
team-size/kill-time metadata — everything server-side completion detection needs.

### 1.4 Reusable assets from the legacy system

- **Task library**: `disc/games/events/task_store/default.json` — ~200 curated OSRS tasks
  (`exact_item`, `point_collection`, `assembly`, `any_of` types with difficulty + points).
- **Live test data**: legacy `events` table holds "Global Bingo #1" (draft) with 57 tasks
  and 4 teams — evidence of the intended product shape.
- **Game-mechanic design**: BoardGame's dice/tiles/shop/effects/cooldowns/mercy-rule and
  its DB schema (`event_items`, `event_team_effects`, `event_team_cooldowns`,
  `event_team_inventory`) are the design reference for Phase C.

### 1.5 Known schema/technical debt (carry into implementation)

- Task-type enum mismatch: legacy DB enum has `loot_value`, `kill_time`, `custom`; web has
  `pb_target`, `skill_target`. Unify when the engine is built.
- Time representation split: legacy uses unix ints, `web_events` uses DateTime (API speaks
  unix seconds). Standardize at the API boundary.
- `web_events.group_id` is nullable — now formally the mechanism for **global events** (D6).
- 17 event-related alembic migrations reflect heavy churn; legacy tables get archived and
  dropped per D2.
- **Hard constraint:** the submission intake hot path is deliberately query-free
  (Redis-first). Event evaluation must be asynchronous — a worker consuming
  already-processed submissions, never synchronous DB work inside intake.

---

## 2. Problem Statement

Groups want to run competitive events (bingo first, board-game races later) on top of the
drop tracking they already have. Today they cannot: the legacy game engine is dead code,
and the new web slice has no engine behind it. Meanwhile every completion signal an event
needs (drops, KC, PBs, clogs, XP) already flows through the submission pipeline — it just
isn't consumed.

## 3. Desired Outcome

One event platform, built on the existing `web_events` foundation:

1. **Event admins** create and configure events on the website — tasks, teams, formation
   mode, dates, verification mode, Discord destinations — gated by the events subscription
   tier. Group admins run group events; superadmins can run global events.
2. **Players** just play OSRS with the plugin installed — qualifying submissions
   automatically complete their team's tasks from the moment they join (never
   retroactively). Where automation can't verify, manual confirmation takes over.
3. **Everyone** follows the event both on the live web event page and **in Discord**, via
   per-event guild/channel notifications — including dedicated event servers.
4. The legacy systems are archived and removed, leaving a single system of record.

## 4. Key Features

### Phase A — Event engine + core platform (the missing foundation)

- **A1. Team membership & formation modes.** Per-event setting (D4):
  - `self_join` — players join a team themselves (open signup / join code);
  - `auto_assign` — system balances joiners across teams automatically;
  - `admin_assign` — event admins place players manually.
  Admin roster management UI + API in all modes (admins can always override). Roster and
  join timestamps shown on the event page. **Join timestamp is load-bearing**: it is the
  cutoff for credit (D10).
- **A2. Completion engine (async worker).** Consumes processed submissions (post-intake,
  via the existing Redis flow), matches them against active events whose participants
  include the submitting player, and records task completions/progress. Idempotent and
  replayable. Only submissions timestamped **after the player joined** and **within the
  event window** count (D10).
- **A3. Task engine v1.** Evaluable semantics for the task types bingo needs first
  (`item_collection` as the workhorse; `kc_target`, `pb_target`, `xp_target`/`skill_target`
  next; legacy `assembly` / `any_of` / `point_collection` semantics adopted from the task
  library where feasible). **Points are optional per task** (D7): completion is the core
  mechanic; a task may carry a point value for ranking, default 0/none. Task library
  seeded from the legacy `default.json` (~200 tasks) via a picker.
- **A4. Verification modes (D3).** Default: automatic pipeline completion. A
  `requires_confirmation` flag settable **per task** and **per event** (event-level flag
  forces it for all tasks). Confirmation queue UI for event admins: pending completions
  with the triggering submission (and its proof/screenshot where available) → approve /
  reject. Manual award/revoke is always available to event admins regardless of mode —
  this is also the escape hatch for pre-join credit (D10) — and every manual action is
  audit-logged.
- **A5. Event lifecycle hardening.** Explicit start/end actions in addition to scheduled
  dates; evaluation frozen outside the active window; archive/delete.
- **A6. Discord integration v1 (D8).** Deep, event-scoped configuration: each event
  selects a **target guild — any guild the bot is a member of** (dedicated event servers
  supported; group events default to the group's linked guild) — and per-notification-type
  channels (announcements, task completions, leaderboard updates, admin/confirmation
  alerts). Reuses the existing webhook/embed + channel-picker infrastructure.
  *Implementation note: the bot lacks the GUILDS intent — guild/channel lists must come
  from Discord REST, not `bot.guilds` (established pattern from the group channel picker).*
- **A7. Live event page.** Team standings (completions and, where points are used, point
  totals), task/board state, recent event activity — reusing the existing SSE realtime
  infrastructure (`use-event-stream.ts`, "feed" scope).
- **A8. Global events (D6).** `group_id = NULL` events, creatable/administered by
  superadmins from `/admin`; listed on the public `/events` index; open to players across
  groups. Group events remain group-scoped.
- **A9. Entitlements & concurrency (D5, D9).** Events remain locked behind the paid
  events subscription tier exactly as gated today (superadmin bypass retained). The number
  of **simultaneously active events per group is a tier-configured limit** (e.g. base
  events tier = 1 active event; higher tiers = more). Enforced at event activation, not
  creation — drafts are unlimited.

### Phase B — Bingo mode (first full game mode, D1)

- **B1. Bingo designer.** Admin UI + API to lay out an N×N board, binding cells to tasks
  (task-library picker, custom tasks, free cells). Board locked once the event starts.
- **B2. Completion detection.** Engine marks cells from A2 completions; configurable
  bonuses for row/column/diagonal/blackout (as optional points or ranking rules).
- **B3. Public board UI.** Upgrade the existing read-only `BingoBoard` component with live
  per-team completion state and cell detail (who completed it, when, with what).
- **B4. Manual confirmation on the board.** A4's confirmation queue and manual
  award/revoke surfaced in board terms (approve a cell claim).
- **B5. Discord board notifications.** Cell completions / line bonuses / blackout posted
  to the event's configured channels.

### Phase C — BoardGame mode (intentional, later — D1)

- **C1. Tile-board race mode** persisted in `web_*` tables: teams advance along a tile
  board by completing tile tasks (the Gielinor Race concept done properly).
- **C2. Dice, shop, effects, cooldowns, mercy rule** — the full legacy BoardGame mechanic
  set, redesigned from the archived legacy schema/code (Section 1.4) rather than ported
  verbatim.
- **C3. Interactive Discord commands** (roll dice, view board, team actions) in the
  event's configured guild — the successor to `eventBot.py`'s role.

### Cross-cutting

- Superadmin oversight of all events in `/admin`; audit-log entries for all admin event
  mutations and manual awards (existing audit-log infra).
- **Legacy decommission (D2):** archive first, then delete —
  1. dump the legacy `events`/`event_*` tables (mysqldump) and copy
     `disc/games/events/`, `disc/eventBot.py`, `disc/games/gielinor_race/` to an archive
     location (e.g. `disc/docs/archive/legacy-events/` or a tarball outside the tree);
  2. import the task library into the new system;
  3. remove the dead code, unregister the `gielinor_race` blueprint from
     `bots/main.py`, and drop the legacy tables via an alembic migration.

## 5. Non-Goals (v1)

- Plugin-side event UI (panels/overlays) — server-side only; revisit after Phase B.
- Prize/GP pool management; split-tracking integration.
- Changes to `group_point_events` (point multipliers stay a separate feature).
- Retroactive auto-credit of any kind (manual award is the only path — D10).

## 6. Decision Log (resolved 2026-07-04)

| # | Question | Decision |
|---|---|---|
| D1 | Game modes & order | Bingo is the first mode; BoardGame is an intentional later addition (Phase C), not a dead end. |
| D2 | Legacy disposition | Delete after backup: archive legacy code + DB data (it may hold useful reference code), then remove code and drop tables. |
| D3 | Verification | Automatic pipeline scoring by default, with a manual-confirmation setting available per task and per event. |
| D4 | Team formation | Per-event configurable: player self-join, automatic assignment, or admin manual assignment. |
| D5 | Monetization | Events stay locked behind the paid subscription tier exactly as gated today. |
| D6 | Event scope | Both global and group events exist. |
| D7 | Task scoring | Points are optional per task — completion is the core mechanic; point values are an optional ranking layer. |
| D8 | Discord | Highly integrated; per-event guild + channel configuration, targetable at **any guild the bot is in** (dedicated event servers supported). |
| D9 | Concurrency | Simultaneous-active-event limit is set by subscription tier. |
| D10 | Retroactivity | No retroactive credit for submissions before a player joined; event admins may manually award instead. |

## 7. Remaining minor open items (defaults stated — override if wrong)

1. **Tier limit values** for D9 (default proposal: current events tier = 1 active event
   per group; define higher values when/if a higher tier exists). Global events are
   superadmin-run and uncapped.
2. **Bingo board sizes** — DECIDED: square boards of 3×3, 4×4, 5×5, 6×6, or 7×7; default **5×5**.
3. **Self-join friction** (default: join code optional per event; without one, signup is
   open to authenticated members of the hosting group — global events open to any
   authenticated user with a linked player).
4. **Auto-assign algorithm** (default: round-robin by join order into the smallest team).
5. **Whether a player may be on teams in multiple concurrent events** (default: yes across
   events, one team per event).

## 8. Implementation Notes for Task Agents

- Build on `disc/db/models/events.py` + `disc/web_api/routes/events.py` + existing Next.js
  pages; **extend, don't rewrite**. Keep the `web_` table prefix; new schema via alembic.
- Expected schema additions (indicative, not prescriptive): event columns for
  `formation_mode`, `requires_confirmation`, `discord_guild_id`, tier/limit metadata;
  per-notification-type channel table (or JSON config); `joined_at` on
  `web_event_team_members`; a completions/progress table keyed by (event, task, team)
  with source-submission reference, status (`auto` / `pending_confirmation` / `confirmed`
  / `manual` / `revoked`), timestamps, and acting admin for manual actions.
- Completion worker follows the existing worker patterns in `disc/workers/` /
  `disc/data/submissions/`, consuming post-processing events via Redis — **never** inside
  the intake hot path.
- Discord: bot has no GUILDS intent — enumerate guilds/channels via REST (same approach as
  the group channel picker). Reuse embed/notification infra from existing group
  notifications.
- Frontend: extend `packages/api-types` zod schemas first, then `lib/api.ts`, then server
  actions + pages, matching the established backend-tasks pattern.
- Entitlements: reuse `assertEventsEntitlement()` / `assert_group_entitlement()`; add the
  active-event-count check at activation time.
- Prod deploy: web_api runs under systemd (`droptracker-webapi.service`); web_api + bot
  restarts required after model changes.
