#!/bin/bash
# =============================================================================
# Stop local observability stack
# =============================================================================
# By default, named volumes (Grafana state, Prometheus TSDB, Loki chunks,
# Tempo blocks) are preserved across restarts. Pass --clean to remove them.
#
# Usage:
#   ./scripts/stop-observability.sh
#   ./scripts/stop-observability.sh --clean
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'
NC='\033[0m'
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }

cd "$PROJECT_ROOT/docker/observability"

if [ "$1" = "--clean" ]; then
  log_info "Stopping observability stack and removing volumes..."
  docker compose down --volumes
else
  log_info "Stopping observability stack (volumes preserved)..."
  docker compose down
fi

log_info "Done."
