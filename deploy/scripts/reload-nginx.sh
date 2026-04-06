#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

MODE="https"

for arg in "$@"; do
  case "$arg" in
    --http-only)
      MODE="http-only"
      ;;
    --https)
      MODE="https"
      ;;
    *)
      fail "Unknown argument: $arg"
      ;;
  esac
done

require_command docker
require_command cp
ensure_paths

if [[ "$MODE" == "http-only" ]]; then
  SOURCE_CONF="$NGINX_HTTP_ONLY_CONF"
else
  SOURCE_CONF="$NGINX_HTTPS_CONF"
fi

print_step "Copying $(basename "$SOURCE_CONF") to $NGINX_DEST_FILE"
cp "$SOURCE_CONF" "$NGINX_DEST_FILE"

print_step "Validating Nginx config inside $NGINX_CONTAINER"
docker exec "$NGINX_CONTAINER" nginx -t

print_step "Reloading $NGINX_CONTAINER"
docker exec "$NGINX_CONTAINER" nginx -s reload

print_step "Nginx reload completed"