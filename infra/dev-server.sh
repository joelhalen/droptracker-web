#!/usr/bin/env bash
#
# Local test-environment control for the DropTracker web front-end.
#
# This host also runs the production DropTracker services, so this dev server is
# intended to be turned on only when you want to view it. It binds to an
# inconspicuous high port and (by default) serves built-in MOCK data — no
# backend Web API is required.
#
# Usage:
#   infra/dev-server.sh start     # build (if needed) + start in the background
#   infra/dev-server.sh stop      # stop the running server
#   infra/dev-server.sh restart
#   infra/dev-server.sh status
#   infra/dev-server.sh logs      # tail the server log
#   infra/dev-server.sh build     # production build only
#
# Env overrides:
#   PORT              (default 31380)   listen port
#   BIND              (default 0.0.0.0) interface to bind; use 127.0.0.1 to keep
#                                       it reachable only via SSH tunnel
#   USE_MOCK_API      (default true)    serve mock data; set false + WEB_API_INTERNAL_URL
#                                       to point at a real Web API v1
#   WEB_API_INTERNAL_URL               real backend URL when USE_MOCK_API=false

set -euo pipefail

# --- resolve paths ----------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$REPO_ROOT/apps/web"
PID_FILE="/tmp/dtweb-dev.pid"
LOG_FILE="/tmp/dtweb-dev.log"

# --- config -----------------------------------------------------------------
PORT="${PORT:-31380}"
BIND="${BIND:-0.0.0.0}"
export USE_MOCK_API="${USE_MOCK_API:-true}"
# Web API v1 (separate backend process, Task 04+). With USE_MOCK_API=true the BFF
# uses real data for implemented endpoints and gracefully falls back to mocks for
# the rest, so the site is fully live-data where the backend exists.
export WEB_API_INTERNAL_URL="${WEB_API_INTERNAL_URL:-http://localhost:31325}"

# --- ensure pnpm/node are on PATH (nvm + corepack) --------------------------
NVM_BIN="$HOME/.nvm/versions/node/v20.20.1/bin"
if [ -d "$NVM_BIN" ]; then
  export PATH="$NVM_BIN:$PATH"
fi
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable pnpm >/dev/null 2>&1 || true
fi

running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

do_build() {
  echo ">> Building production bundle (USE_MOCK_API=$USE_MOCK_API) ..."
  ( cd "$REPO_ROOT" && pnpm gen:api-types && pnpm build )
}

do_start() {
  if running; then
    echo ">> Already running (pid $(cat "$PID_FILE")) on port $PORT."
    return 0
  fi
  if [ ! -d "$APP_DIR/.next" ]; then
    do_build
  fi
  echo ">> Starting DropTracker web on http://$BIND:$PORT (USE_MOCK_API=$USE_MOCK_API) ..."
  # setsid gives the server its own process group so `stop` can reap the whole
  # tree (pnpm wrapper + next-server child) reliably.
  cd "$APP_DIR"
  echo "   Web API: $WEB_API_INTERNAL_URL"
  PORT="$PORT" HOSTNAME="$BIND" WEB_API_INTERNAL_URL="$WEB_API_INTERNAL_URL" \
    setsid pnpm start >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  sleep 3
  if running; then
    echo ">> Up. pid $(cat "$PID_FILE"). Logs: $LOG_FILE"
    echo "   Local:   http://127.0.0.1:$PORT"
    [ "$BIND" = "0.0.0.0" ] && echo "   Network: http://<this-host-ip>:$PORT"
  else
    echo "!! Failed to start. Last log lines:"; tail -20 "$LOG_FILE"; exit 1
  fi
}

do_stop() {
  if running; then
    local pid; pid="$(cat "$PID_FILE")"
    echo ">> Stopping pid $pid (and its process group) ..."
    # Negative pid targets the whole process group (setsid leader == pid).
    kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    sleep 2
    kill -KILL "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
  echo ">> Stopped."
}

case "${1:-}" in
  start)   do_start ;;
  stop)    do_stop ;;
  restart) do_stop; do_start ;;
  build)   do_build ;;
  status)
    if running; then echo "running (pid $(cat "$PID_FILE"), port $PORT)"; else echo "stopped"; fi ;;
  logs)    tail -f "$LOG_FILE" ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs|build}"; exit 1 ;;
esac
