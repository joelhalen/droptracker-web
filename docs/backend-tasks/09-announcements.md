# Task 09 — Announcements + Discord syndication

**Goal:** back the announcements feature — the only "forum-like" feature we keep.
Web pages are the canonical, SEO-indexed source; Discord is the syndication
target (this inverts today's Discord-first model).

**Plan refs:** FRONTEND_PLAN.md §10 (all), §6.1/§6.3, §13 (announcements table),
§14.1 (Homepage announcements feed — Replace).

## Prerequisites
- `announcements` table from Task 08.
- Config key `announcements_channel_id` (and seasonal mirror) honored — already in
  the shared registry (Task 05).

## Contracts

### Reads (public, cached)
```
GET /api/v1/announcements?scope=global|group:{id}&cursor=     -> AnnouncementPage
GET /api/v1/announcements/{id}                                 -> Announcement
```
`AnnouncementPage` = `{ items: Announcement[], next_cursor: string|null }`
(cursor pagination). `Announcement` shape (see `AnnouncementSchema`):
```json
{ "id": 1, "scope_type": "group", "group_id": 42, "title": "...",
  "body_md": "...", "cover_image_url": null, "pinned": false,
  "author_name": "Clan Staff", "published_at": 1719000000 }
```
Only `status = 'published'` rows are returned on public reads. Order: pinned
first, then `published_at` desc.

### Writes (session + authorization)
```
POST  /api/v1/groups/{groupId}/announcements   (group admin)   -> { id }
POST  /api/v1/announcements                     (superadmin; global)  -> { id }
PATCH /api/v1/announcements/{id}                (author/admin)  -> Announcement
DELETE/archive /api/v1/announcements/{id}       (author/admin)
```
Request body (see `AnnouncementInputSchema`):
```json
{ "scope_type": "group", "group_id": 42, "title": "...", "body_md": "...",
  "pinned": false, "cover_image_url": null, "post_to_discord": true }
```
- The front-end forces `scope_type="group"` + `group_id` from the route for the
  group composer; global announcements are superadmin-only (§9 site admin).
- Validate `title` (1–200) and non-empty `body_md`. Sanitize/limit Markdown on
  render; store raw Markdown.

## Discord syndication (§10.1, §10.2)

**Do not open a new Discord connection from the Web API.** Follow the existing
architecture rule: *processors never send Discord messages directly* (§10.2).
Instead:
1. On publish, insert the `announcements` row (`status='published'`,
   `published_at=now`).
2. If `post_to_discord` and the group has `announcements_channel_id`, enqueue a
   job (reuse the `notification_queue` pattern) describing the post. The Discord
   bot process drains it and posts to the channel.
3. The bot writes back `discord_message_id` / `discord_channel_id` on the row so
   later edits/deletes can sync (best-effort, like the existing notification
   flow).
4. **Realtime:** publish an `announcement` event (Task 07) to the relevant scope
   (`rt:global` or `rt:group:{id}`) so open browsers show it instantly.

Edits/unpublish optionally update/delete the Discord message via the same
enqueue→bot path.

## Authorization
- Group announcements: `current_user()` is owner/admin of `groupId`.
- Global announcements: superadmin only.
- Edits/delete: original author, a group admin of the scope, or superadmin.

## Acceptance criteria
- Public reads return only published rows, pinned-first, cursor-paginated, in the
  exact `Announcement`/`AnnouncementPage` shapes.
- `POST /groups/{id}/announcements` creates a row and (when enabled + channel set)
  enqueues a Discord post via the bot — **not** a direct Discord call from the API.
- A published announcement emits an `announcement` realtime event.
- The web `/groups/{id}/announcements` composer and the public `/announcements`
  pages work with `USE_MOCK_API=false`.
