# Task 19 — Discord integration: per-event guild/channel config + notifications

**Goal:** deep Discord integration (D8): every event can target **any guild the
bot is a member of** — including dedicated event servers — with
per-notification-type channels; event happenings post there through the existing
notification pipeline. Depends on Tasks 15 + 17.

**PRD refs:** §4 A6, B5, D8. Constraint: the bot lacks the GUILDS intent — never
use `bot.guilds`; use Discord REST / the established Redis cache pattern
(`web_api/routes/config.py` channel picker reads `guild:{guild_id}:channels`).

## Bot side (disc/bots/main.py + a small service)

- Maintain a Redis cache `bot:guilds` = JSON list of `{id, name, icon?}` for all
  guilds the bot is in, refreshed periodically (e.g. every 5 min) via Discord
  REST (`GET /users/@me/guilds`, paginated) using the bot token — same approach
  as the existing per-guild channel cache. Reuse/extend whatever populates
  `guild:{guild_id}:channels` so it can be triggered for an arbitrary guild id.

## Web API

```
GET /api/v1/events/{id}/discord
    -> { guild_id?, guild_name?, channels: { announcements?, completions?,
         leaderboard?, admin? } }
GET /api/v1/events/discord/guilds            -> [{ id, name }]        (event-admin only)
GET /api/v1/events/discord/guilds/{guildId}/channels -> [{ id, name, category? }]
PUT /api/v1/events/{id}/discord
    { guild_id, channels: { announcements?, completions?, leaderboard?, admin? } }
    -> updated config
```

- Auth: event admin (group owner/admin; superadmin for global). Guild/channel
  lists come from the Redis caches; cache miss returns `{stale: true}` + empty
  list and the UI falls back to manual ID entry (existing pattern).
- PUT validates channel ids belong to the chosen guild (against the cache when
  available), writes `web_events.discord_guild_id` + `web_event_channels`
  rows, audit-logs `event.discord.update`.
- Group events default `guild_id` to the group's linked guild at creation.

## Notification dispatch

Extend `services/notification_service.py` with handlers for new
`notification_queue` types (produced by the engine, Task 17, and lifecycle,
Task 21):

| type | channel kind | embed |
|---|---|---|
| `event_started` / `event_ended` | announcements | event card; final standings on end |
| `event_completion` | completions | task done: team, task label, player, proof thumbnail, points if any |
| `event_cell` / `event_line` / `event_blackout` | completions | bingo board moment (cell label, team, bonus) |
| `event_lead_change` | leaderboard | new leader + top-3 standings |
| `event_pending` | admin | pending completion awaiting review (deep-link to the Review tab) |

- Channel resolution: `web_event_channels` by (event_id, kind); fall back
  `completions/leaderboard/admin -> announcements`; no channel configured →
  mark processed, skip silently.
- Embed builders in `utils/embeds.py` alongside existing ones; keep the visual
  language of current drop embeds (item icons via existing static assets;
  event name in author line; link to `https://www.droptracker.io/events/{id}`).
- Lead-change detection: engine compares team score order before/after applying
  points and enqueues `event_lead_change` only when rank 1 changes.

## Frontend

- Event manager gains a **Discord** tab: guild select (from
  `/events/discord/guilds`), then one channel picker per notification kind
  (reuse the existing `ChannelPicker` component/pattern from group config),
  manual-ID fallback, save via PUT.

## Acceptance criteria

- An event pointed at a *different* guild than the group's posts there
  (verified with a test guild).
- All five notification families deliver with correct channel fallbacks; no
  configured channel → no error spam.
- `bot.guilds` is never referenced; everything flows REST → Redis cache → web_api.
- Config round-trips through the UI with `USE_MOCK_API=false`; audit-logged.
