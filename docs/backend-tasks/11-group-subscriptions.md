# Task 11 — Group recurring subscriptions (upgrades)

**Goal:** back the group **Subscription** admin tab and the public pricing page
with a recurring-billing model — the "upgrades" system.

**Plan refs:** FRONTEND_PLAN.md §14.1 (`/Upgrades/` — Replace; "upgrade/downgrade
lifecycle stays in backend services"), §9 ("group upgrade status"), §6.2/§6.3.

> **Scope correction (supersedes parts of §6/§9/§14):** the points-based
> **feature store** (`/api/v1/features`, `/features/{key}/activate`,
> point credits/debits, `FeatureStore.php`) is **NOT being built**. There is no
> point-spending UI. Groups instead hold a single **recurring subscription** to a
> tier. Ignore the feature-store endpoints from the original plan; implement the
> subscription endpoints below. The `Player`/`me` points *display* (read-only) may
> still exist elsewhere, but no spending flows.

## Model

A group has at most one active subscription to a **tier**. Billing lifecycle
(create, renew, upgrade/downgrade with proration, cancel-at-period-end, resume,
dunning for `past_due`) is owned by the backend + a payment provider (Stripe
recommended; Patreon if reusing `Core/Service/Patreon.php`). The Web API exposes
status and kicks off provider-hosted flows; it does **not** handle card data.

Suggested tables (Alembic, Task 08 style):
```
subscription_tiers ( key PK, name, description, price_cents, currency,
                     interval ENUM('month','year'), features JSON, recommended BOOL,
                     provider_price_id, active BOOL )
group_subscriptions ( id PK, group_id FK UNIQUE, tier_key FK subscription_tiers.key,
                      status ENUM('none','active','trialing','past_due','canceled','expired'),
                      provider ENUM('patreon','stripe','manual'),
                      provider_customer_id, provider_subscription_id,
                      current_period_end, cancel_at_period_end BOOL,
                      created_at, updated_at )
```
Map a tier to its effect on the group (e.g. enables `seasonal_boards`, raises
history limits). Keep that mapping server-side; the front-end only shows
`features` text.

## Contracts

### `GET /api/v1/subscriptions/tiers`  (public, cached ~5m)
Array of `SubscriptionTier`:
```json
[ { "key": "premium", "name": "Premium", "description": "...",
    "price_cents": 500, "currency": "USD", "interval": "month",
    "features": ["Seasonal lootboards", "Extended history", "Priority processing"],
    "recommended": true } ]
```
Include a `free` tier (price_cents 0) for the marketing page. Only `active` tiers.

### `GET /api/v1/groups/{groupId}/subscription`  (session + group admin)
`GroupSubscription`:
```json
{ "group_id": 42, "tier_key": "premium", "status": "active", "provider": "stripe",
  "current_period_end": 1719000000, "cancel_at_period_end": false }
```
Groups with no subscription: `{ tier_key: null, status: "none", provider: null,
current_period_end: null, cancel_at_period_end: false }`.

### `POST /api/v1/groups/{groupId}/subscription/checkout`  (session + group admin)
Body `{ "tier_key": "premium" }`. Behavior:
- **No active sub →** create a provider Checkout session; return
  `{ "url": "https://checkout..." }` for the browser to redirect to.
- **Active sub, different tier →** either return a Checkout/confirm URL **or**
  perform an in-place proration and return `{ "url": null }` (the front-end then
  just refreshes). Pick one; document which.
Return shape: `CheckoutSession = { "url": string | null }`.

### `POST /api/v1/groups/{groupId}/subscription/cancel`  (session + group admin)
Set `cancel_at_period_end = true` with the provider; return the updated
`GroupSubscription`. The group keeps benefits until `current_period_end`.

### `POST /api/v1/groups/{groupId}/subscription/resume`  (session + group admin)
Clear `cancel_at_period_end`; return the updated `GroupSubscription`.

### `POST /api/v1/groups/{groupId}/subscription/portal`  (session + group admin)
Create a provider **billing portal** session (update card, invoices, cancel);
return `{ "url": ... }`.

## Provider webhooks (critical)
The source of truth for `status` / `current_period_end` is the **provider**.
Implement a webhook endpoint (separate from the browser API surface, e.g.
`POST /api/v1/webhooks/billing`, provider-signature-verified) that updates
`group_subscriptions` on `checkout.session.completed`,
`customer.subscription.updated/deleted`, `invoice.payment_failed`, etc. Never
trust the client to report subscription state. On activation/expiry, flip the
group's entitlements and (optionally) notify via the bot (reuse the queue).

## Authorization
- Reads of a group's subscription and all mutations: owner/admin of `groupId`,
  re-checked server-side.
- Tiers list is public.

## `/me` (optional)
You may surface the user's manageable group subscriptions in `/me` or a dedicated
`GET /api/v1/me/subscriptions` for a future "My premium" dashboard. Not required
for the current front-end (it reads per-group).

## Acceptance criteria
- Tiers, group-subscription read, checkout, cancel, resume, and portal endpoints
  return the exact contract shapes and enforce admin authorization.
- Provider webhooks keep `status`/`current_period_end`/`cancel_at_period_end`
  accurate without client input.
- Canceling sets `cancel_at_period_end` and retains benefits until period end;
  resume reverses it.
- No points/feature-store endpoints are implemented.
- The web `/groups/{id}/subscription` tab and public `/premium` page work with
  `USE_MOCK_API=false`.
