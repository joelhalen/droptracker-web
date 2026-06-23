# Infrastructure

Deployment artifacts for DropTracker Web (FRONTEND_PLAN.md §16).

- `Dockerfile.web` — containerizes the Next.js BFF (`apps/web`). Build from the
  repo root: `docker build -f infra/Dockerfile.web -t droptracker-web .`

## Topology

- **Front-end (Next.js / BFF):** Vercel or a self-hosted Node container behind
  the existing reverse proxy.
- **Web API v1 (Python/Quart):** a separate process/service with its own DB pool
  (recommended port `31325`), kept distinct from the RuneLite intake API on
  `31323` so website traffic never competes with submission processing.
- **Realtime gateway:** part of the Web API process initially (Redis pub/sub →
  SSE); split out if connection counts grow.

The Web API itself lives in the **backend repo** (plan §5, Option A) so it can
import `db/`, `services/`, and `utils/` directly. This repo consumes only its
OpenAPI contract, vendored in `packages/api-types/openapi.json`.
