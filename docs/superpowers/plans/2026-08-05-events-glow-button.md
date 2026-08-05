# Events Glow Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Glowing "your event" buttons above the Active section on `/events`, sourced from the backend's existing `GET /events?mine=true`.

**Architecture:** One new BFF client method (`api.eventsMine`), one pure pick-and-order helper in `lib/events.ts`, one presentational server component, one insertion point in the events page. Mock data grows a draft event and a "mine" subset so every state is exercisable in mock mode.

**Tech Stack:** Next.js 15 App Router (RSC), Zod, Tailwind v4, `node:test` via tsx.

Spec: `docs/superpowers/specs/2026-08-05-events-glow-button-design.md`

## Global Constraints

- Browser → BFF only; the new method lives in `apps/web/lib/api.ts` and is server-side.
- Zod-validate the backend response (`EventSummarySchema.array()`).
- No contract sync: response shape is unchanged; `mine` is only a query param.
- Event-shaping logic lives in `apps/web/lib/events.ts` (pure, unit-tested), not components.
- Button copy, verbatim: live → `⚡ Live: {name}`, upcoming → `Upcoming: {name}`.
- Cap: at most 3 buttons. Live (status `active`) before upcoming (status `draft`); `past` never shows.
- Zero candidates or signed out → render nothing (page identical to today).
- Personalization failures degrade silently: `.catch(() => [])`.
- Respect `prefers-reduced-motion`: pulse animation only under `motion-safe:`.
- Tests are `node:test` via tsx; run from `apps/web/`: `node --import tsx --test test/<file>.test.ts`.

---

### Task 1: `api.eventsMine` + mock data

**Files:**
- Modify: `apps/web/lib/mock-data.ts` (`mockEvents` at ~L1622; add a draft event + `mockEventsMine`)
- Modify: `apps/web/lib/api.ts` (insert after `eventsForAdmin`, ~L946; add `mockEventsMine` to the `./mock-data` import block ending ~L411)
- Test: `apps/web/test/events-mine.test.ts` (create)

**Interfaces:**
- Consumes: existing `EventSummarySchema`, `apiGet`, `withFallback`, `mockEvents`.
- Produces:
  - `api.eventsMine(params?: { status?: "draft" | "active" | "past" }): Promise<EventSummary[]>`
  - `mockEventsMine(status?: string): EventSummary[]` — mock "mine" subset: event ids 1 (active), 3 (active), 5 (draft), 2 (past).
  - Mock event id 5: `"Autumn Ladder"`, `status: "draft"`, starts in 4 days — also appears in `mockEvents()` so the page's existing Upcoming section stays consistent in mock mode.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/events-mine.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { EventSummarySchema } from "@droptracker/api-types";
import { mockEvents, mockEventsMine } from "../lib/mock-data";

test("mockEventsMine parses as EventSummary[] and is a subset of mockEvents", () => {
  const mine = EventSummarySchema.array().parse(mockEventsMine());
  assert.ok(mine.length >= 3, "expected live + upcoming + past in the mine mock");
  const allIds = new Set(mockEvents().map((e) => e.id));
  for (const e of mine) assert.ok(allIds.has(e.id), `mine event ${e.id} missing from mockEvents`);
});

test("mockEventsMine covers every state the button needs", () => {
  const statuses = new Set(mockEventsMine().map((e) => e.status));
  assert.ok(statuses.has("active"));
  assert.ok(statuses.has("draft"));
  assert.ok(statuses.has("past"));
});

test("mockEventsMine honors the status filter", () => {
  assert.ok(mockEventsMine("draft").every((e) => e.status === "draft"));
  assert.ok(mockEventsMine("draft").length >= 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/web/`): `node --import tsx --test test/events-mine.test.ts`
Expected: FAIL — `mockEventsMine` is not exported.

- [ ] **Step 3: Implement mock data**

In `apps/web/lib/mock-data.ts`, inside `mockEvents`, append a 5th entry to the `all` array (after the id-4 "Loot Sweep Duos" entry, before `return`):

```ts
    {
      id: 5,
      group_id: groupId ?? 101,
      name: "Autumn Ladder",
      description: "A ranked ladder of weekly boss targets — sign up before kickoff.",
      status: "draft",
      starts_at: now + 4 * DAY,
      ends_at: now + 18 * DAY,
      has_bingo: false,
      kind: "standard" as const,
      activated_at: null,
      ...eventDefaults,
    },
```

Then, directly after the `mockEvents` function, add:

```ts
/** Mock "mine" scope (GET /events?mine=true): the viewer's clan events —
 * two live, one upcoming draft, one past — so mock mode exercises every
 * glow-button state (multiple live, upcoming fallback, past excluded). */
export function mockEventsMine(status?: string): EventSummary[] {
  const MINE_IDS = new Set([1, 3, 5, 2]);
  return mockEvents(undefined, status).filter((e) => MINE_IDS.has(e.id));
}
```

- [ ] **Step 4: Run test — mock half passes**

Run: `node --import tsx --test test/events-mine.test.ts`
Expected: PASS (all three tests).

- [ ] **Step 5: Add `api.eventsMine`**

In `apps/web/lib/api.ts`: add `mockEventsMine` to the existing `from "./mock-data"` import list. Then insert after the `eventsForAdmin` method (after its closing `},` at ~L946):

```ts
  /** The viewer's clan events (GET /events?mine=true): events of every group
   * the session user belongs to or administers, plus clan-vs-clan events those
   * groups accepted as opponents. Anonymous callers get []. Authed + uncached
   * (viewer-specific). Powers the /events glow buttons. */
  async eventsMine(
    params: { status?: "draft" | "active" | "past" } = {},
  ): Promise<EventSummary[]> {
    const q = new URLSearchParams({ mine: "true" });
    if (params.status) q.set("status", params.status);
    return withFallback(
      async () => EventSummarySchema.array().parse(await apiGet(`/events?${q}`, { authed: true })),
      () => mockEventsMine(params.status),
    );
  },
```

- [ ] **Step 6: Typecheck and full test suite**

Run (repo root): `pnpm typecheck && pnpm test`
Expected: PASS. (If `contract.test.ts` asserts over mock events, the new draft event must satisfy `EventSummarySchema` — it does, `activated_at` is nullable.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/mock-data.ts apps/web/lib/api.ts apps/web/test/events-mine.test.ts
git commit -m "events: api.eventsMine wires the backend's mine=true scope"
```

---

### Task 2: pick-and-order helper in `lib/events.ts`

**Files:**
- Modify: `apps/web/lib/events.ts` (append; pure exports only, matches file convention)
- Test: `apps/web/test/events-mine.test.ts` (extend)

**Interfaces:**
- Consumes: `EventSummary` type from `@droptracker/api-types`.
- Produces: `pickYourEventButtons(events: EventSummary[]): EventSummary[]` — filtered, ordered, capped at 3. Consumed by Task 3's page wiring.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/test/events-mine.test.ts`:

```ts
import { pickYourEventButtons } from "../lib/events";
import type { EventSummary } from "@droptracker/api-types";

function ev(over: Partial<EventSummary> & { id: number }): EventSummary {
  return EventSummarySchema.parse({
    id: over.id,
    group_id: 101,
    name: `Event ${over.id}`,
    status: "active",
    starts_at: 1_000,
    ends_at: 2_000,
    ...over,
  });
}

test("pickYourEventButtons: live first (soonest end), then upcoming (soonest start)", () => {
  const picked = pickYourEventButtons([
    ev({ id: 1, status: "draft", starts_at: 5_000 }),
    ev({ id: 2, status: "active", ends_at: 9_000 }),
    ev({ id: 3, status: "active", ends_at: 3_000 }),
  ]);
  assert.deepEqual(picked.map((e) => e.id), [3, 2, 1]);
});

test("pickYourEventButtons: past excluded, cap at 3", () => {
  const picked = pickYourEventButtons([
    ev({ id: 1, status: "past" }),
    ev({ id: 2, status: "active", ends_at: 1_000 }),
    ev({ id: 3, status: "active", ends_at: 2_000 }),
    ev({ id: 4, status: "active", ends_at: 3_000 }),
    ev({ id: 5, status: "draft", starts_at: 4_000 }),
  ]);
  assert.deepEqual(picked.map((e) => e.id), [2, 3, 4]);
});

test("pickYourEventButtons: null timestamps sort last within their bucket", () => {
  const picked = pickYourEventButtons([
    ev({ id: 1, status: "active", ends_at: null }),
    ev({ id: 2, status: "active", ends_at: 7_000 }),
    ev({ id: 3, status: "draft", starts_at: null }),
    ev({ id: 4, status: "draft", starts_at: 6_000 }),
  ]);
  assert.deepEqual(picked.map((e) => e.id), [2, 1, 4]);
});

test("pickYourEventButtons: empty input renders nothing", () => {
  assert.deepEqual(pickYourEventButtons([]), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test test/events-mine.test.ts`
Expected: FAIL — `pickYourEventButtons` is not exported.

- [ ] **Step 3: Implement the helper**

Append to `apps/web/lib/events.ts`:

```ts
/** Pick which of the viewer's clan events (GET /events?mine=true) earn a glow
 * button on /events: live ones first (soonest end), then upcoming drafts
 * (soonest start), capped at 3. Null timestamps sort last in their bucket;
 * past events never show. */
export function pickYourEventButtons(events: EventSummary[]): EventSummary[] {
  const byTime = (t: (e: EventSummary) => number | null) => (a: EventSummary, b: EventSummary) =>
    (t(a) ?? Infinity) - (t(b) ?? Infinity);
  const live = events.filter((e) => e.status === "active").sort(byTime((e) => e.ends_at));
  const upcoming = events.filter((e) => e.status === "draft").sort(byTime((e) => e.starts_at));
  return [...live, ...upcoming].slice(0, 3);
}
```

(`EventSummary` is already imported in `lib/events.ts` via its existing type imports; add it to the import from `@droptracker/api-types` if absent.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test test/events-mine.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/events.ts apps/web/test/events-mine.test.ts
git commit -m "events: pickYourEventButtons ordering helper"
```

---

### Task 3: glow-button component + page wiring

**Files:**
- Create: `apps/web/components/event-live-buttons.tsx`
- Modify: `apps/web/app/globals.css` (append keyframes next to the existing `record-glow` block, ~L304)
- Modify: `apps/web/app/(site)/(public)/events/page.tsx:16-53`

**Interfaces:**
- Consumes: `pickYourEventButtons` (Task 2), `api.eventsMine` (Task 1).
- Produces: `<EventLiveButtons events={EventSummary[]} />` — renders `null` for `[]`.

- [ ] **Step 1: Add the glow keyframes**

Append to `apps/web/app/globals.css` (after the existing `@keyframes record-glow` block):

```css
/* /events glow buttons: pulsing gold halo on the viewer's live events. */
@keyframes event-glow-pulse {
  0%,
  100% {
    box-shadow: 0 0 14px 3px rgba(212, 175, 55, 0.45);
  }
  50% {
    box-shadow: 0 0 22px 6px rgba(212, 175, 55, 0.7);
  }
}
```

- [ ] **Step 2: Create the component**

Create `apps/web/components/event-live-buttons.tsx`:

```tsx
import Link from "next/link";
import type { EventSummary } from "@droptracker/api-types";

/** Glowing quick links back into the viewer's clan events, shown above the
 * Active section on /events. Input is already picked/ordered/capped by
 * `pickYourEventButtons` — this component is purely presentational. */
export function EventLiveButtons({ events }: { events: EventSummary[] }) {
  if (!events.length) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {events.map((e) => {
        const live = e.status === "active";
        return (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className={
              live
                ? "border-osrs-gold text-osrs-gold-bright motion-safe:animate-[event-glow-pulse_2.2s_ease-in-out_infinite] rounded-md border bg-gradient-to-b from-[#3a2f1a] to-[#241f16] px-5 py-2.5 font-semibold shadow-[0_0_14px_3px_rgba(212,175,55,0.45)] transition-transform hover:scale-[1.02]"
                : "border-osrs-gold/60 text-osrs-gold rounded-md border bg-gradient-to-b from-[#2d2718] to-[#241f16] px-5 py-2.5 font-semibold shadow-[0_0_9px_1px_rgba(212,175,55,0.3)] transition-transform hover:scale-[1.02]"
            }
          >
            {live ? <>⚡ Live: {e.name}</> : <>Upcoming: {e.name}</>} →
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Wire the page**

In `apps/web/app/(site)/(public)/events/page.tsx`:

Add imports:

```tsx
import { pickYourEventButtons } from "@/lib/events";
import { EventLiveButtons } from "@/components/event-live-buttons";
```

Extend the `Promise.all` (signed-in only, degrade to `[]` on failure — same pattern as the recruiting fetch):

```tsx
  const [active, past, upcoming, recruiting, mine] = await Promise.all([
    api.events({ status: "active" }),
    api.events({ status: "past" }),
    // Drafts the signed-in viewer may see: events of clans they belong to
    // (pre-publication landing) plus drafts they administer.
    user ? api.eventsForAdmin({ status: "draft" }).catch(() => []) : Promise.resolve([]),
    user ? api.eventRecruiting().catch(() => []) : Promise.resolve([]),
    user ? api.eventsMine().catch(() => []) : Promise.resolve([]),
  ]);
  const yourEventButtons = pickYourEventButtons(mine);
```

Render directly above the Active section (between the Upcoming section and `<EventSection title="Active" …/>`):

```tsx
      <EventLiveButtons events={yourEventButtons} />
```

- [ ] **Step 4: Gates**

Run (repo root): `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/event-live-buttons.tsx apps/web/app/globals.css "apps/web/app/(site)/(public)/events/page.tsx"
git commit -m "events: glowing your-event buttons above the Active list"
```

---

### Task 4: mock-mode browser verification (all states)

**Files:** none (verification only). Use the project's `verify` skill to launch/drive the app if available in-session; the manual steps below are the fallback.

- [ ] **Step 1: Launch dev server in mock mode**

Run (repo root): `pnpm dev` (mock mode is the dev default, `USE_MOCK_API=true`). Wait for `http://localhost:3000`.

- [ ] **Step 2: Signed-out state**

Load `http://localhost:3000/events` without a session. Expected: no glow buttons; page shows Active/Past exactly as before (plus "Autumn Ladder" nowhere — drafts hidden signed-out).

- [ ] **Step 3: Signed-in state (multiple buttons: live × 2 + upcoming, cap ordering)**

Sign in via the mock flow (`/api/auth/login` sets `dt_session=mock-session` when no Discord app is configured). Reload `/events`. Expected, in order:
1. `⚡ Live: Summer Bingo 2026 →` — pulsing glow (mock id 1, ends in 11 days)
2. `⚡ Live: GWD Loot Sweep →` — pulsing glow (mock id 3, ends in 9 days... note id 3 ends in 9 days, id 1 in 11 → **GWD Loot Sweep sorts first**; verify soonest-end-first ordering, i.e. actual order is GWD Loot Sweep, then Summer Bingo)
3. `Upcoming: Autumn Ladder →` — soft static glow
Past mock event ("Spring Boss Race") must NOT appear as a button. Each button navigates to its `/events/{id}`.

- [ ] **Step 4: Reduced-motion state**

In devtools, emulate `prefers-reduced-motion: reduce`. Expected: glow present, pulse animation absent.

- [ ] **Step 5: Record results**

Report each state with what was seen (screenshots if driving a browser). Any mismatch → fix before proceeding, re-run gates from Task 3 Step 4.

---

## Self-review notes

- Spec coverage: data (Task 1), helper + ordering/cap (Task 2), component/styling/reduced-motion/page insertion (Task 3), error degradation (`.catch(() => [])`, Task 3 Step 3), signed-out/none states (Task 4 + Task 2 empty-input test), mock-mode verification of all states (Task 4). Follow-up items in the spec (backend openapi documentation) are explicitly out of scope.
- Task 4 Step 3 deliberately encodes the ordering quirk (GWD Loot Sweep before Summer Bingo) so the verifier checks sorting, not just presence.
