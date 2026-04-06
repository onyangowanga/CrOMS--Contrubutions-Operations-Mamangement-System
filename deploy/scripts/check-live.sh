#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

require_command curl
ensure_paths

HEALTH_URL="$(resolve_health_url)"

print_step "Checking local health endpoint: $HEALTH_URL"
curl --fail --silent --show-error "$HEALTH_URL"
printf '\n'

print_step "Checking HTTP redirect for $DOMAIN"
curl --fail --silent --show-error --location --head "http://$DOMAIN/"

print_step "Checking public HTTPS health endpoint"
curl --fail --silent --show-error "https://$DOMAIN/api/health"
printf '\n'

print_step "Live checks completed"