#!/usr/bin/env bash
#
# DropTracker web deploy — one command: install, generate types, build,
# restart, verify.
#
# Usage:
#   scripts/deploy.sh [--skip-install] [--dry-run]
#
#   --skip-install  skip `pnpm install --frozen-lockfile`
#   --dry-run       print state-changing commands instead of executing them
#                   (the final read-only health probe still runs, against the
#                   currently running server)
#
# Requires: the invoking user can `sudo systemctl restart droptracker-node`.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DRY_RUN=0
SKIP_INSTALL=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-install) SKIP_INSTALL=1 ;;
        --dry-run)      DRY_RUN=1 ;;
        -h|--help)      sed -n '2,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "Unknown flag: $1 (known: --skip-install --dry-run)" >&2; exit 2 ;;
    esac
    shift
done

step() { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }
run() {
    if [[ $DRY_RUN -eq 1 ]]; then
        echo "[dry-run] would run: $*"
    else
        echo "+ $*"
        "$@"
    fi
}

# --------------------------------------------------------------- 1. install
if [[ $SKIP_INSTALL -eq 1 ]]; then
    step "pnpm install (skipped: --skip-install)"
else
    step "pnpm install --frozen-lockfile"
    run pnpm install --frozen-lockfile
fi

# ------------------------------------------------------- 2. generated types
step "pnpm gen:api-types"
run pnpm gen:api-types

# ------------------------------------------------------------------ 3. build
step "pnpm build"
run pnpm build

# ---------------------------------------------------------------- 4. restart
# IMPORTANT: the restart must IMMEDIATELY follow the build. On 2026-07-07 the
# site went down with ChunkLoadError because the old `next start` process kept
# running against the freshly rebuilt .next directory — its ISR revalidation
# writes polluted the new build output, so browsers were served chunk
# references that no longer existed. Never leave a gap between `pnpm build`
# and this restart, and never run anything else against .next in between.
step "restart droptracker-node (immediately after build — see comment)"
run sudo systemctl restart droptracker-node

# ----------------------------------------------------------- 5. health check
# `next start` takes a few seconds to come up; poll for up to ~60s.
step "health check :31380"
if [[ $DRY_RUN -eq 1 ]]; then
    echo "  (dry-run: nothing was restarted — probing the currently running server)"
fi
HEALTH=FAIL
for i in $(seq 1 30); do
    code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:31380/ 2>/dev/null || true)"
    if [[ "$code" == "200" ]]; then
        HEALTH=PASS
        break
    fi
    sleep 2
done

# --------------------------------------------------------------- 6. summary
step "summary"
printf '  %-34s %s\n' "CHECK" "RESULT"
printf '  %-34s %s\n' "-----" "------"
printf '  %-34s %s\n' "http :31380/ == 200" "$HEALTH"
if [[ "$HEALTH" != "PASS" ]]; then
    printf '\n\033[31mDEPLOY: FAIL\033[0m — droptracker-node did not return 200 within ~60s.\n'
    printf 'Check: journalctl -u droptracker-node -n 50\n'
    exit 1
fi
if [[ $DRY_RUN -eq 1 ]]; then
    printf '\nDRY-RUN COMPLETE — no state was changed.\n'
else
    printf '\n\033[32mDEPLOY: PASS\033[0m\n'
fi
