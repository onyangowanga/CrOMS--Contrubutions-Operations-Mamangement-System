#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

SKIP_PULL=0
SKIP_NGINX=0
SKIP_CHECKS=0

for arg in "$@"; do
  case "$arg" in
    --skip-pull)
      SKIP_PULL=1
      ;;
    --skip-nginx)
      SKIP_NGINX=1
      ;;
    --skip-checks)
      SKIP_CHECKS=1
      ;;
    *)
      fail "Unknown argument: $arg"
      ;;
  esac
done

require_command docker
require_command curl
ensure_paths

if [[ $SKIP_PULL -eq 0 && -d "$ROOT_DIR/.git" ]]; then
  print_step "Updating repository with git pull --ff-only"
  git -C "$ROOT_DIR" pull --ff-only
fi

print_step "Building and restarting CrOMS services"
compose_vps up -d --build

if [[ $SKIP_NGINX -eq 0 ]]; then
  print_step "Syncing Nginx config into the shared EOMS proxy container"
  "$SCRIPT_DIR/reload-nginx.sh"
fi

if [[ $SKIP_CHECKS -eq 0 ]]; then
  print_step "Running post-deploy health checks"
  "$SCRIPT_DIR/check-live.sh"
fi

print_step "Redeploy completed"