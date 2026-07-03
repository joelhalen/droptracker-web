# Task 15 — Tier entitlements (feature permissions)

**Goal:** Lock premium features (Events, Hall of Fame) behind subscription tiers,
configurable by superadmins on `/admin/tiers`, enforced server-side and reflected
in the group admin UI.

**Plan refs:** Task 11 scope correction (tier→capability mapping), group-config
registry pattern (§11.1).

## Concepts

| Concept | Storage | Purpose |
|---------|---------|---------|
| **Marketing `features[]`** | `subscription_tiers.features` | Pricing page bullet points |
| **Entitlements** | `subscription_tiers.entitlements` | Runtime access control |
| **Resolved entitlements** | `GET /groups/{id}/subscription` | What the group can use now |

## Registry

Shared TypeScript: `packages/api-types/src/entitlements.ts`  
Python parity: `disc/web_api/entitlements_registry.py`  
Parity test: `disc/tests/unit/test_entitlements_registry.py`

Initial entitlement keys:

- `events` — group event CRUD
- `hall_of_fame` — HoF config keys (`personal_best_embed_boss_list`,
  `hof_individual_boss_messages`)

## Migration rule

Unsubscribed groups (no active/trialing subscription) resolve entitlements from a
fallback tier: ``free``, then ``basic``, then registry defaults (all ``false``).

Tiers with an empty ``entitlements`` column also use registry defaults. Configure
explicit checkboxes on ``/admin/tiers`` for each paid tier.

## API

- `GET /subscriptions/tiers` — includes resolved `entitlements` per tier
- `GET /groups/{id}/subscription` — includes resolved `entitlements` for the group
- `POST/PATCH /admin/subscriptions/tiers` — accepts `entitlements` object
- `POST/PATCH /events/*` — requires `events` entitlement
- `PATCH /groups/{id}/config` — HoF keys require `hall_of_fame` entitlement

Superadmins bypass entitlement checks (mirrors `canAdminGroup`).

## Frontend

- `lib/entitlements.ts` — `hasEntitlement()`, `getEntitlements()`
- `components/feature-gate.tsx` — upgrade card wrapper
- `/admin/tiers` — Capabilities checkboxes in `TierManager`
- Group admin layout — Events tab shows 🔒 when locked
- `ConfigEditor` — locks fields with `entitlement` metadata in `group-config.ts`

## Adding a new entitlement

1. Add to `ENTITLEMENT_FIELDS` in `entitlements.ts`
2. Mirror in `entitlements_registry.py`
3. Extend parity test
4. Gate UI (tab, page, or config field `entitlement:`)
5. Add `assert_group_entitlement()` on backend write paths
6. Configure tiers on `/admin/tiers`
