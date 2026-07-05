# Task 16 — Event team membership & formation modes

**Goal:** let players get onto teams — the three formation modes of PRD D4 —
plus admin roster management. Depends on Task 15 (schema v2).

**PRD refs:** §4 A1, D4, D10; Section 7 defaults 3–5.

## Semantics

- `formation_mode` (per event): `self_join` | `auto_assign` | `admin_assign`.
- **self_join**: an authenticated user joins one of their linked players to a
  chosen team. If `web_events.join_code` is set, the correct code is required.
- **auto_assign**: user requests to join; server places the player on the team
  with the fewest members (ties → lowest team id). No team choice offered.
- **admin_assign**: only event admins place players; join endpoint returns 403.
- Eligibility: group events → the player must be a member of the group
  (`user_group_association`); global events (`group_id NULL`) → any player
  linked to the authenticated user.
- One team per player per event (enforce across the event's teams).
- `joined_at` is recorded at insert and is the **credit cutoff** (D10) — the
  engine (Task 17) ignores submissions timestamped earlier.
- Leaving/removal deletes the membership row; existing ledger rows and progress
  are untouched (history stands; admins can revoke via Task 18 if needed).
- Roster changes are allowed while `draft` or `active`; blocked once `past`.

## Contracts

### Player-facing (session required)

```
POST /api/v1/events/{id}/join    { player_id, team_id?, join_code? } -> { team_id }
POST /api/v1/events/{id}/leave   { player_id }                        -> { ok }
```
- `player_id` must belong to the session user (`players.user_id`).
- `team_id` required for self_join (unless only one team exists), forbidden for
  auto_assign, endpoint 403s for admin_assign.
- Errors: 403 wrong/missing join_code or mode; 404 event/team; 409 already on a
  team in this event or event `past`.

### Admin (event admin = group owner/admin, or superadmin for global events)

```
POST   /api/v1/events/{id}/teams/{teamId}/members   { player_id }  -> { ok }
DELETE /api/v1/events/{id}/teams/{teamId}/members/{playerId}       -> { ok }
```
- Admin add works in every formation mode and may move a player between teams
  (delete+insert; `joined_at` resets on move — document this).
- Audit-log both (`event.member.add` / `event.member.remove`, Task 21 helper).

### Reads

- `EventDetail.teams[]` gains `members: [{ player_id, player_name, joined_at }]`.
- `EventDetail` gains `viewer: { player_ids_on_event: [...], team_id? } | null`
  (for the signed-in user) and `formation_mode`, `join_requires_code: bool`
  (never the code itself on public reads).

## Frontend

- Public event page (`apps/web/app/(public)/events/[id]/page.tsx`): join panel —
  player picker (user's linked players), team picker (self_join), join-code
  input when required, leave button; roster listed per team.
- Admin event manager (`components/event-manager.tsx`): formation-mode select +
  join-code field on the event settings form; per-team roster with add-player
  (search within group members) and remove.
- Server actions follow `app/(admin)/groups/[id]/events/actions.ts` pattern;
  api client methods in `lib/api.ts`; mock fallbacks in `lib/mock-data.ts`.

## Acceptance criteria

- All three modes behave per semantics above, verified against a real DB.
- Ownership, eligibility, one-team-per-event, and join-code checks enforced
  server-side; join_code never leaks in public payloads.
- `joined_at` persisted and returned; admin add/remove audit-logged.
- Public join UI and admin roster UI work with `USE_MOCK_API=false`.
