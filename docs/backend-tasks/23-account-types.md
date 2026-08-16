# Task 23 — OSRS account types (game modes) on players

> **Audience:** an agent working inside the DropTracker backend repository.
> Front-end refs: `packages/api-types/src/index.ts` (`AccountTypeSchema`,
> `PlayerProfileSchema.account_type`), `apps/web/lib/account-types.ts`.

## Context

The web front-end now renders a game-mode helmet badge next to the RSN on
`/players/{id}`. The field is **optional** on the contract: profiles render
fine while this task is unshipped or for players whose mode was never
reported. The value originates from the RuneLite plugin, which reads the
account-type varbit (**varbit 1777**) and includes it with submissions.

## Data flow

1. **Plugin (separate repo, coordinate the release):** read varbit 1777 on
   login / when it changes; include `account_type` in the submission payload
   sent to the intake API.
2. **Intake API (`:31323`):** accept an **optional** `account_type` field on
   submission payloads. Unknown/absent values are ignored — intake behavior is
   otherwise untouched (README guardrail 2).
3. **Storage:** persist on the player row. **Last-write-wins**, so a
   de-ironed account naturally downgrades to `normal` on its next submission.
   Store the string verbatim after validating against the enum below.
4. **Web API v1 (`:31325`):** include `account_type` in the player profile
   payload for `GET /players/{id}`.

## Contract

Enum values (varbit 1777 value → wire string):

| varbit | wire value |
|---|---|
| 0 | `normal` |
| 1 | `ironman` |
| 2 | `ultimate_ironman` |
| 3 | `hardcore_ironman` |
| 4 | `group_ironman` |
| 5 | `hardcore_group_ironman` |
| 6 | `unranked_group_ironman` |

`GET /players/{id}` response gains:

```json
{ "account_type": "hardcore_ironman" }
```

- Optional; omit (or `null`) when never reported.
- The front-end parses the field as an open string and ignores values it
  doesn't recognize, so adding a future mode is backward-compatible — but
  update the OpenAPI + web-repo Zod in lockstep as usual.

## Migration

Add a nullable `account_type` column (short varchar) to the player table via
the established migration mechanism (Task 08). Backfill is **not** required;
the field populates organically as players submit.

## Out of scope

- Hiscores-based inference or manual selection in `/settings`.
- Exposing the field on leaderboards, search, or group member payloads
  (follow-ups once the profile field is live).

## Acceptance criteria

- Submission with a valid `account_type` updates the player row; invalid or
  missing values leave it unchanged and never fail the submission.
- `GET /players/{id}` returns the stored value; omits/nulls it when unset.
- De-iron scenario: a later submission with `normal` overwrites `ironman`.
- No regression to intake throughput (field parse is additive).
- OpenAPI updated; web repo re-vendors `openapi.json` + `pnpm gen:api-types`.
