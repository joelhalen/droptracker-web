#!/usr/bin/env bash
#
# DropTracker web deploy — ZERO-DOWNTIME blue-green.
#
# Two systemd units run continuously, each building into its own output dir:
#   blue  -> droptracker-node-blue.service    PORT 31380  NEXT_DIST_DIR .next-blue
#   green -> droptracker-node-green.service   PORT 31381  NEXT_DIST_DIR .next-green
# (`systemctl restart droptracker-node` is a oneshot that runs THIS script.)
# nginx routes to whichever colour is PRIMARY in
#   /etc/nginx/conf.d/droptracker-node-upstream.conf
# (the other colour is `backup` — a crash safety-net; no traffic in steady state).
#
# This script builds the CURRENT source into the IDLE colour, restarts that
# (unused) instance, polls /api/health until it answers, then rewrites the
# upstream so the freshly-built colour is primary and `nginx -s reload`s. A
# reload never drops the listen socket and the new build is already warm, so
# users see no interruption. The previously-active colour keeps running its old
# build → instant rollback (just re-run this script, or swap the two server
# lines in the upstream conf and `sudo nginx -s reload`).
#
# Why not a plain `pnpm build && systemctl restart`? (1) A single instance is
# offline for the ~10-20s `next start` takes to boot. (2) `next build` overwrites
# .next in place while the old process serves it → the 2026-07-07 ChunkLoadError
# outage. Per-colour output dirs + a warmed standby avoid both. NOTE: a bare
# `pnpm build` now writes to `.next`, which NEITHER instance serves — always
# deploy through this script.
#
# Usage:
#   scripts/deploy.sh [--skip-install] [--dry-run]
#     --skip-install  skip `pnpm install --frozen-lockfile`
#     --dry-run       print what would happen; change nothing
#
# Requires: the invoking user can `sudo systemctl restart droptracker-node*`
# and `sudo nginx -t / -s reload` / write the upstream conf.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$REPO/apps/web"
UPSTREAM_CONF=/etc/nginx/conf.d/droptracker-node-upstream.conf
HEALTH_PATH=/api/health
HEALTH_TIMEOUT=90
LOCKFILE=/tmp/droptracker-deploy-web.lock

BLUE_PORT=31380;  BLUE_UNIT=droptracker-node-blue;   BLUE_DIST=.next-blue
GREEN_PORT=31381; GREEN_UNIT=droptracker-node-green; GREEN_DIST=.next-green

DRY_RUN=0; SKIP_INSTALL=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-install) SKIP_INSTALL=1 ;;
    --dry-run)      DRY_RUN=1 ;;
    -h|--help)      sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown flag: $1 (known: --skip-install --dry-run)" >&2; exit 2 ;;
  esac
  shift
done

log()  { printf '\033[1;36m[deploy]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[deploy] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }
run()  { if [[ $DRY_RUN -eq 1 ]]; then echo "[dry-run] would run: $*"; else echo "+ $*"; "$@"; fi; }

# Serialise deploys — two at once would fight over output dirs and the nginx conf.
exec 9>"$LOCKFILE"
flock -n 9 || die "another deploy is already running (lock: $LOCKFILE)"

# --- Which colour is live right now? (primary = the server line without `backup`)
active_port=$(grep -E '^\s*server\s+127\.0\.0\.1:[0-9]+' "$UPSTREAM_CONF" \
  | grep -v backup | grep -oE ':[0-9]+' | tr -d ':' | head -1) || true
[[ -n "${active_port:-}" ]] || die "cannot find the active (primary) server in $UPSTREAM_CONF"

if [[ "$active_port" == "$BLUE_PORT" ]]; then
  ACTIVE=blue;  IDLE=green; IDLE_PORT=$GREEN_PORT; IDLE_UNIT=$GREEN_UNIT; IDLE_DIST=$GREEN_DIST
elif [[ "$active_port" == "$GREEN_PORT" ]]; then
  ACTIVE=green; IDLE=blue;  IDLE_PORT=$BLUE_PORT;  IDLE_UNIT=$BLUE_UNIT;  IDLE_DIST=$BLUE_DIST
else
  die "active port $active_port is neither blue ($BLUE_PORT) nor green ($GREEN_PORT)"
fi
log "Active: $ACTIVE (:$active_port). Deploying into idle: $IDLE (:$IDLE_PORT, $IDLE_DIST)."

# --- Install (optional) -------------------------------------------------------
if [[ $SKIP_INSTALL -eq 1 ]]; then
  log "pnpm install skipped (--skip-install)."
else
  log "pnpm install --frozen-lockfile"
  run bash -c "cd '$REPO' && pnpm install --frozen-lockfile"
fi

# --- Build the idle colour (bypass turbo: its cache key ignores NEXT_DIST_DIR) -
log "pnpm gen:api-types"
run bash -c "cd '$REPO' && pnpm gen:api-types"
log "Building source into $IDLE_DIST…"
run bash -c "cd '$APP' && NEXT_DIST_DIR='$IDLE_DIST' ./node_modules/.bin/next build"

# `next build` rewrites next-env.d.ts's typedRoutes reference to the colour it
# just built (.next-blue/.next-green), which would leave the git tree perpetually
# dirty and flip-flopping every deploy. That file is declaration-only (never read
# at runtime), so normalise it back to the committed default (.next).
run bash -c "sed -i 's#\\.next-[a-z]*/types/routes\\.d\\.ts#.next/types/routes.d.ts#' '$APP/next-env.d.ts'"

# --- Restart idle instance & wait for readiness ------------------------------
log "Restarting $IDLE_UNIT…"
run sudo systemctl restart "$IDLE_UNIT"

if [[ $DRY_RUN -eq 1 ]]; then
  log "[dry-run] would wait for :$IDLE_PORT$HEALTH_PATH, then flip nginx primary → $IDLE and reload."
  log "DRY-RUN COMPLETE — nothing changed."
  exit 0
fi

log "Waiting up to ${HEALTH_TIMEOUT}s for $IDLE (:$IDLE_PORT) to become healthy…"
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
until curl -fsS -m 2 "http://127.0.0.1:${IDLE_PORT}${HEALTH_PATH}" >/dev/null 2>&1; do
  [[ $(date +%s) -ge $deadline ]] && die "$IDLE did not pass ${HEALTH_PATH} within ${HEALTH_TIMEOUT}s — NOT flipping. Traffic stays on $ACTIVE."
  sleep 1
done
log "$IDLE is healthy."

# --- Flip nginx to the new colour (graceful reload) --------------------------
log "Repointing nginx: primary → $IDLE (:$IDLE_PORT), standby → $ACTIVE (:$active_port)…"
sudo tee "$UPSTREAM_CONF" >/dev/null <<EOF
# Blue-green upstream for the Next.js front-end (droptracker-node* units).
# The ACTIVE colour is primary; the standby is \`backup\` so it only receives
# traffic if the active instance is down (runtime crash safety net) — steady
# state sends everything to the active colour, never load-balanced.
#
# MANAGED BY scripts/deploy.sh — do not hand-edit the server lines.
# Rollback = swap the two server lines and \`sudo nginx -s reload\`.
upstream droptracker_node {
    server 127.0.0.1:${IDLE_PORT} max_fails=1 fail_timeout=5s;   # active: ${IDLE}
    server 127.0.0.1:${active_port} backup;                      # standby: ${ACTIVE}
}
EOF

sudo nginx -t 2>/dev/null || die "nginx -t failed after rewriting $UPSTREAM_CONF — NOT reloading. Inspect the file."
sudo nginx -s reload
printf '\033[1;36m[deploy]\033[0m \033[32mDEPLOY: PASS\033[0m — LIVE: %s (:%s) on %s. Rollback: re-run this script (flips back to %s).\n' "$IDLE" "$IDLE_PORT" "$IDLE_DIST" "$ACTIVE"
