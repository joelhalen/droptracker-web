# Task 04 — Leaderboards, profiles, and search

**Goal:** back the public read site — global/group leaderboards (with day/week/
month/all-time partitions), player and group profiles, and search. This is the
Phase 1 read-only deliverable and can ship before auth.

**Plan refs:** FRONTEND_PLAN.md §6.1, §2.2 (existing endpoints), §8.5 (Redis
keys), §18 (top_groups precompute), §20.1 (endpoint mapping).

## Endpoints & contracts

### Leaderboards (public, cached)
```
GET /api/v1/leaderboards/players?period=&scope=&page=&limit=
GET /api/v1/leaderboards/groups?period=&page=&limit=
```
- `period` ∈ `YYYYMM | YYYYWW | YYYYMMDD | all` (§6.5). Map to the canonical Redis
  partition (Task 07). Today only monthly (`YYYYMM`) exists — daily/weekly/all
  require the key work in Task 07; until then, return monthly for any period and
  note the limitation, OR implement Task 07 first.
- `scope` (players only) ∈ `global | group:{id} | npc:{id}`.
- Response (`LeaderboardPageSchema`):
```json
{ "period": "all", "scope": "global",
  "entries": [ { "rank": 1, "id": 1337, "name": "Zezima",
                 "loot": { "value": 2000000000, "value_formatted": "2.0B" },
                 "delta": 0 } ],
  "meta": { "page": 1, "limit": 25, "total": 5000 } }
```
- **Players** map from the existing `GET /top_players` (Redis sorted set read) —
  add paging (`ZREVRANGE` with offset/limit) and `period`/`scope` (§20.1).
- **Groups** map from `GET /top_groups`, which today **recomputes over all groups
  per request** (expensive — §2.2, §18). **Fix:** maintain a per-partition group
  total in a Redis sorted set on drop writes (in `services/redis_updates.py`) and
  read it like the player leaderboard. See Task 07.

### Player profile (public, cached)
```
GET /api/v1/players/{playerId}                 -> PlayerProfileSchema
GET /api/v1/players/{playerId}/submissions?type=&cursor=
```
- Base this on the existing `GET /player_search` payload (it already returns loot,
  rank, top NPC, groups, recent submissions, points — §2.2). Reshape to:
```json
{ "id": 1337, "name": "Zezima", "global_rank": 1,
  "total_loot": { "value": ..., "value_formatted": "..." },
  "points": 4200, "top_npc": "Vorkath",
  "groups": [ { "id": 2, "name": "Global" } ],
  "recent_submissions": [ { "id": 1, "type": "drop", "label": "Twisted bow",
      "value": { "value": ..., "value_formatted": "..." }, "ts": 1719000000 } ] }
```
- `type` filters submissions to `drop|clog|pb|ca|pet|level|quest`. Use cursor
  pagination for the full submissions feed.

### Group profile (public, cached)
```
GET /api/v1/groups/{groupId}                   -> GroupProfileSchema
GET /api/v1/groups/{groupId}/members?page=
GET /api/v1/groups/{groupId}/submissions?cursor=
```
- Base on the existing `GET /group_search` (members, rank, top player, recent
  submissions, stats — §2.2). Reshape to `GroupProfileSchema`
  (`id, name, description, member_count, global_rank, monthly_loot, discord_url,
  top_player, recent_submissions`). `discord_url` comes from the
  `discord_url` config key.

### Search (public, cached)
```
GET /api/v1/players/search?q=     -> [PlayerSummary]
GET /api/v1/groups/search?q=      -> [{ id, name, member_count }]
GET /api/v1/search?q=             -> SearchResults  (combined; used by web /search)
```
- The web `/search` page calls the **combined** `GET /api/v1/search?q=` returning
  `{ players: [...], groups: [...] }` (`SearchResultsSchema`). Implement that as a
  thin aggregator over the two specific search routes. Cap results (e.g. 10 each),
  match by name prefix/contains.

## Performance rules (§15, §18)
- Serve from Redis + short-TTL cache; never block on WOM/OSRS calls in the request
  path.
- Add the group-total precompute so `/leaderboards/groups` is O(page), not
  O(all groups).
- Send `Cache-Control` + `ETag`.

## Acceptance criteria
- All four contracts return exact shapes; money uses the `{value, value_formatted}`
  envelope via `format_number`.
- `/leaderboards/groups` no longer recomputes over all groups per request.
- `period` accepts all four partition forms (once Task 07 lands).
- The web home, `/leaderboards`, `/players/{id}`, `/groups/{id}`, and `/search`
  render against the real API with `USE_MOCK_API=false`.
