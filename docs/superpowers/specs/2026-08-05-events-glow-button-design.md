# Events page: glowing "your event" buttons — design

Date: 2026-08-05
Status: approved (brainstormed with visual companion)

> **Revision (same day, after trying the button row in mock mode):** the
> standalone glow-button row duplicated events already listed on the page
> (an upcoming event appeared as both a button and an Upcoming card). It was
> replaced by a **"Your events" card section** at the top: the viewer's live
> + upcoming clan events as regular event cards, uncapped, with the gold
> glow around the whole card (plus an "⚡ Live" chip) on live ones. Events
> shown there are filtered OUT of the Upcoming/Active sections below, so
> nothing renders twice. Helper renamed `pickYourEventButtons` →
> `pickYourEvents` (no cap); the `EventLiveButtons` component was removed in
> favor of a `glowLive` flag on the page's `EventSection`. Everything below
> describes the original button design where it conflicts, this note wins.

## Goal

Give a signed-in visitor to `/events` an immediate, high-visibility path back
into the events their clans are running — without restructuring the page.

## Scope

One addition to the existing public events page: a glowing button row inserted
between the page heading (and recruiting banner / Upcoming section, when
present) and the **Active** section. Everything else on the page is unchanged.

Explicitly out of scope (discussed and dropped during brainstorming):

- A "Your events" section with past-participation ("Previously") rows
- A role-aware "Create an event" CTA / docs link
- Per-player team-membership precision (backend viewer stake on the list
  payload) — the clan-level `mine=true` scope is accepted as-is

## Data

New method in `apps/web/lib/api.ts`:

```
api.eventsMine(params?: { status?: "draft" | "active" | "past" }): Promise<EventSummary[]>
```

The events page calls it status-less and buckets client-side (see UI); the
`status` param exists for parity with `eventsForAdmin` and future callers.

- Calls `GET /events?mine=true[&status=…]`, authed (`authed: true`), uncached
  (viewer-specific), mirroring `eventsForAdmin`.
- Zod-parses with the existing `EventSummarySchema.array()`.
- Mock fallback reuses `mockEvents` so mock mode shows the button.

Backend facts this relies on (verified in `droptracker-core`
`web_api/routes/events.py` `list_events`, on the active `new-api` branch):

- `mine=true` already exists: events owned by any group the session user
  belongs to or administers, **plus** clan-vs-clan events those groups have
  accepted as opponents. Anonymous callers get `[]`.
- Draft/private visibility is filtered per-viewer server-side; no extra
  client-side handling needed.
- The response is plain `EventSummary[]` — no schema change, so **no contract
  sync** (`openapi.json` / `gen:api-types`) is required.

Follow-up (not this feature): document the `mine` and `guildId` query params in
the backend's `web_api/openapi.json` and re-vendor it here.

## UI

Component `apps/web/components/event-live-buttons.tsx`, rendered by
`apps/web/app/(site)/(public)/events/page.tsx` above the Active section,
signed-in only. The pick-and-order logic is a pure function in
`apps/web/lib/events.ts` (repo convention: event shaping logic lives there,
unit-tested, not in components).

Selection & ordering: the page makes one status-less `eventsMine()` fetch and
buckets the result client-side by `status` (the backend's effective status —
`active` = live, `draft` = upcoming, `past` ignored):

1. Live (`status === "active"`) events first, soonest `ends_at` first.
2. Then upcoming (draft) events, soonest `starts_at` first.
3. Cap at 3 buttons; anything beyond remains reachable in the page lists.
4. Zero candidates → render nothing; the page is byte-for-byte today's page.

Button content and style:

- Live: `⚡ Live: {event name} →`, gold border (`osrs-gold` palette), strong
  outer glow with a slow pulse animation.
- Upcoming: `Upcoming: {event name} →`, softer static glow.
- Each button links to `/events/{id}`.
- Respect `prefers-reduced-motion`: no pulse animation.

## Errors

The `eventsMine` fetch is wrapped `.catch(() => [])` (same pattern as the
page's recruiting fetch): any backend failure hides the buttons and degrades
to today's page. Never a 500 from personalization.

## Testing

- `node:test` (via `tsx`, no Jest/Vitest):
  - Mock-mode test: `api.eventsMine` parses and returns `EventSummary[]`.
  - Unit test for the pick-and-order helper (pure function
    `EventSummary[] → EventSummary[]`, capped at 3): live-beats-upcoming,
    tie-breaks, cap, empty input.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Browser verification in mock mode (`verify` skill): button row renders for a
  signed-in mock user; absent when signed out.
