# Task 02 — Discord OAuth, session issuance, and `/me`

**Goal:** let the BFF exchange a Discord profile for an authoritative session and
read the current user. The BFF performs the OAuth redirect/code-exchange itself;
the backend's job is **find-or-create the user, mint a session, and resolve
identity + roles**.

**Plan refs:** FRONTEND_PLAN.md §7 (all), §2.3 (identity model), §13.

## Background: how the BFF calls you

The BFF already implements steps 1–2 of §7.1 (redirect to Discord, handle the
callback, exchange the `code` for a Discord access token, fetch the Discord
profile). It then calls **you**:

```
POST /api/v1/auth/discord
Content-Type: application/json
{
  "discord_profile": { "id": "...", "username": "...", "global_name": "...", "avatar": "..." },
  "discord_access_token": "..."   // usable to fetch guilds for role derivation
}
->
200 { "session_token": "<JWT-or-opaque>" }
```

The BFF stores `session_token` in an httpOnly cookie named `dt_session` and
forwards it on later requests as `Cookie: dt_session=<token>`. **All authed Web
API routes read identity from this cookie.**

> See `apps/web/app/api/auth/callback/route.ts` and `apps/web/lib/session.ts` in
> the web repo for the exact client behavior.

## Endpoints

### `POST /api/v1/auth/discord`  (called by BFF only)
1. **Find-or-create** the `users` row keyed on `discord_id` (== `discord_profile.id`).
   Reuse the existing `try_create_user`-style logic. Set/refresh display name and
   avatar. Do **not** require `xf_user_id` (XenForo is being retired; leave the
   column untouched/null for new users — §7.4).
2. Optionally use `discord_access_token` to fetch the user's guilds
   (`GET https://discord.com/api/users/@me/guilds`) and cache them (short TTL in
   Redis) for role derivation. Detect guilds where the user has `MANAGE_GUILD`.
3. **Mint a session** (see "Session strategy"). Encode at least `user_id` and an
   expiry. Return `{ "session_token": ... }`.

### `GET /api/v1/me`  (session required)
Return the `Me` shape (see `MeSchema` in the contract):
```json
{
  "user_id": 1,
  "discord_id": "207...",
  "display_name": "...",
  "avatar_url": "https://cdn.discordapp.com/avatars/.../....png",
  "players": [ { "id": 1337, "name": "Zezima", "global_rank": 1,
                 "total_loot": { "value": 2000000000, "value_formatted": "2.0B" } } ],
  "groups": [ { "id": 101, "name": "Clan 1", "role": "owner" } ]
}
```
- `players`: all `players` rows where `players.user_id == user_id`. Include rank +
  total loot (reuse the same Redis reads as the player leaderboard).
- `groups`: every group the user belongs to (`user_group_association` joined via
  their players), with a derived `role` (see below).
- On no/invalid session: **401** with an RFC-7807 body. The BFF treats 401 as
  "logged out" and shows the sign-in button.

## Role derivation (§7.2)

For each group, `role` is the highest of:
- `owner` — user created/owns the group (group creator), **or** has `MANAGE_GUILD`
  on the linked Discord guild (`guilds.group_id`).
- `admin` — explicit grant in the new `group_admins` table (Task 08), or
  `MANAGE_GUILD` (your call whether MANAGE_GUILD is owner- or admin-level; the
  front-end treats owner+admin identically for "can manage").
- `member` — belongs to the group otherwise.

The front-end gates admin UI with `role ∈ {owner, admin}` but the **API must
re-check** on every write (Tasks 03, 05, 06).

## Session strategy (§7.1 step 4, §13)

Pick one (the plan recommends the first):

- **Stateless JWT (recommended):** sign with the existing `JWT_TOKEN_KEY` (HS256).
  Claims: `sub=user_id`, `iat`, `exp` (short, e.g. 1h). For revocation, keep a
  Redis deny-list and/or a refresh token in Redis. No new table needed.
- **Opaque + `web_sessions` table (Task 08):** store a random token server-side;
  look it up per request. Easier revocation, one DB read per request.

Provide a `current_user()` dependency in `web_api/deps.py` that:
1. Reads `dt_session` from the cookie.
2. Validates (JWT verify or table lookup); rejects expired/denied.
3. Loads the `users` row and returns it (or raises 401).

## Logout

The BFF clears its own cookie locally; no backend call is required. If you use a
server-side deny-list, optionally expose `POST /api/v1/auth/logout` to revoke the
presented token (the BFF can call it best-effort).

## Security notes
- Validate the Discord profile id is a snowflake; never trust client-sent
  `user_id`.
- The BFF holds the Discord client secret and does the code exchange; you only
  receive the resulting profile/token. Do not log the access token.
- Rate-limit `POST /auth/discord`.

## Acceptance criteria
- A first-time Discord login creates a `users` row keyed on `discord_id` and
  returns a working session.
- `GET /api/v1/me` returns the exact `Me` shape with correct `players` and
  `groups[].role`.
- Invalid/expired session → 401 (RFC-7807). The web dashboard
  (`/dashboard`, `/settings`) then redirects to sign-in.
- No dependency on `xf_user_id` for new logins.
