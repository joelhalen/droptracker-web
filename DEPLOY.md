# Deploying DropTracker Web

The app is a standard Next.js (App Router) application in a pnpm + Turborepo
monorepo. It runs **with no backend** when `USE_MOCK_API=true` — built-in mock
data and a synthetic live SSE stream — so you can stand up a fully clickable
public demo (including the dev "Sign in with Discord" mock login) before the Web
API v1 exists.

> Node 20+ required. The web app lives in `apps/web`.

## Option A — Vercel (recommended, ~2 minutes)

Vercel natively supports Next.js + pnpm workspaces.

1. Go to <https://vercel.com/new> and import `joelhalen/droptracker-web`.
2. Set **Root Directory** to `apps/web` (Vercel installs the whole workspace
   from the repo root automatically).
3. Framework preset: **Next.js** (auto-detected). Build & install commands:
   leave as default.
4. Add an environment variable:
   - `USE_MOCK_API` = `true`  ← serves mock data, no backend needed
   - *(optional)* `NEXTAUTH_URL` = `https://<your-project>.vercel.app`
5. **Deploy.** You'll get a public `https://<project>.vercel.app` URL.

Every push to the branch gets a preview URL; `main` becomes production.

### Wiring up the real backend later
Once the Web API v1 exists (see `docs/backend-tasks/`), set `USE_MOCK_API=false`,
`WEB_API_INTERNAL_URL` to the API's URL, and the Discord OAuth vars from
`.env.example`. No code changes — the BFF switches from mock to live.

## Option B — Docker (any container host: Fly.io, Render, Railway, a VPS)

A Dockerfile for the BFF already exists at `infra/Dockerfile.web`. Build from the
**repo root**:

```bash
docker build -f infra/Dockerfile.web -t droptracker-web .
docker run -p 3000:3000 -e USE_MOCK_API=true droptracker-web
# visit http://localhost:3000
```

Deploy that image to any container platform and expose port 3000.

## Option C — Run it locally

```bash
pnpm install
USE_MOCK_API=true pnpm build
USE_MOCK_API=true pnpm --filter @droptracker/web start
# visit http://localhost:3000
```

For live-reload development, use `USE_MOCK_API=true pnpm dev` instead.

## Production (droptracker.io)

The live site runs on the DropTracker box as **two** systemd units,
`droptracker-node-blue.service` + `droptracker-node-green.service` (zero-downtime
blue-green — see below; unit files vendored in the backend repo at
`deploy/systemd/`). A third unit, `droptracker-node.service`, is a **deploy
trigger** (oneshot): `sudo systemctl restart droptracker-node` runs the full
deploy.

- `next start` (two instances for zero-downtime deploys — see below),
  `WorkingDirectory=/store/droptracker/web/apps/web`
- Env comes from `apps/web/.env.local`, which is a **symlink** to the repo-root
  `.env` (real Discord OAuth, `USE_MOCK_API=false`,
  `WEB_API_INTERNAL_URL=http://127.0.0.1:31325`)
- It talks to the Web API v1 (`droptracker-webapi.service`, port 31325) from
  the backend repo; Cloudflare fronts the box. Note `SESSION_COOKIE_SECURE`
  must stay `false` while the origin is plain HTTP behind Cloudflare Flexible
  SSL — Secure cookies get silently dropped and sign-in loops.

### Zero-downtime deploys (blue-green)

The site runs **two** identical Next.js instances behind nginx, each building
into its own output dir so a live instance's build is never overwritten while
it serves:

| Unit | Port | `NEXT_DIST_DIR` |
|---|---|---|
| `droptracker-node-blue.service` | 31380 | `.next-blue` |
| `droptracker-node-green.service` | 31381 | `.next-green` |

nginx routes to whichever colour is **primary** in
`/etc/nginx/conf.d/droptracker-node-upstream.conf`; the other is `backup`
(a runtime crash safety-net — no traffic in steady state). `droptracker-node`
itself is **not a server** — it's the deploy trigger; never `systemctl restart`
the blue/green units simultaneously (that would cause downtime).

To ship a change, run the deploy script (or `sudo systemctl restart
droptracker-node`, which runs exactly this via a systemd oneshot —
`journalctl -u droptracker-node -f` to watch):

```bash
cd /store/droptracker/web
scripts/deploy.sh            # flags: --skip-install, --dry-run
```

It builds the current source into the **idle** colour, restarts that (unused)
instance, polls `/api/health` on its port until it answers, then rewrites the
upstream so the freshly-built colour is primary and `nginx -s reload`s. A reload
never drops the listen socket and the new build is already warm, so **users see
no interruption**. The previously-active colour keeps running its old build, so
rollback is instant: **re-run `scripts/deploy.sh`** (it flips back), or swap the
two `server` lines in the upstream conf and `sudo nginx -s reload`.

> **Do not** deploy with a bare `pnpm build && systemctl restart` anymore. A
> plain `pnpm build` writes to `.next`, which *neither* instance serves (they
> use `.next-blue` / `.next-green`), and a single-instance restart reintroduces
> both the ~10-20s offline window and the 2026-07-07 in-place-`.next`
> ChunkLoadError outage. Always deploy through `scripts/deploy.sh`.

## What works in mock mode

Everything is clickable without a backend:

- Public: leaderboards (with live-updating SSE deltas), player/group profiles,
  search, announcements, events, native lootboards, `/docs`, `/premium`.
- Auth: click **Sign in with Discord** — with no OAuth app configured it performs
  a dev mock login, so the dashboard, group admin, subscriptions, and the
  superadmin `/admin` area are all reachable.

> Mock mode is for demos only. For production, configure the real Web API and
> Discord OAuth and set `USE_MOCK_API=false`.
