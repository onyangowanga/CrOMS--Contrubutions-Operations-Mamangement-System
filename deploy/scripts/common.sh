#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/deploy"
ENV_FILE="$DEPLOY_DIR/.env"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.vps.yml"
DOMAIN="croms.event-oms.online"
NGINX_CONTAINER="eoms-nginx"
NGINX_DEST_DIR="/opt/eoms/nginx/conf.d"
NGINX_DEST_FILE="$NGINX_DEST_DIR/$DOMAIN.conf"
NGINX_HTTPS_CONF="$DEPLOY_DIR/nginx/$DOMAIN.conf"
NGINX_HTTP_ONLY_CONF="$DEPLOY_DIR/nginx/$DOMAIN.http-only.conf"

print_step() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

load_env() {
  [[ -f "$ENV_FILE" ]] || fail "Missing env file: $ENV_FILE"

  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
}

compose_vps() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

ensure_paths() {
  [[ -f "$COMPOSE_FILE" ]] || fail "Missing compose file: $COMPOSE_FILE"
  [[ -f "$NGINX_HTTPS_CONF" ]] || fail "Missing nginx config: $NGINX_HTTPS_CONF"
  [[ -f "$NGINX_HTTP_ONLY_CONF" ]] || fail "Missing nginx config: $NGINX_HTTP_ONLY_CONF"
}

resolve_health_url() {
  load_env
  local host_port="${APP_HOST_PORT:-4100}"
  printf 'http://127.0.0.1:%s/api/health' "$host_port"
}