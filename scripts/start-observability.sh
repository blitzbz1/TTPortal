#!/bin/bash
# =============================================================================
# Start local observability stack
# =============================================================================
# Brings up Prometheus, Loki, Promtail, Grafana, Tempo, and the OTel Collector
# as Docker containers. Runs alongside the Supabase CLI stack — start Supabase
# first (`npx supabase start`) so Promtail has logs to scrape.
#
# Usage:
#   ./scripts/start-observability.sh
#
# Stop with:
#   ./scripts/stop-observability.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

cd "$PROJECT_ROOT/docker/observability"

if ! docker ps --format '{{.Names}}' | grep -q '^supabase_edge_runtime'; then
  log_warn "Supabase Edge Runtime container not detected — start Supabase first with 'npx supabase start'."
  log_warn "Promtail will start but won't have logs to scrape until Supabase is up."
fi

log_info "Starting observability stack..."
docker compose up -d

echo ""
log_info "=========================================="
log_info "Observability stack is running"
log_info "=========================================="
echo ""
echo "Access points:"
echo "  - Grafana:    http://localhost:3001  (admin/admin)"
echo "  - Prometheus: http://localhost:9090"
echo "  - Loki:       http://localhost:3100"
echo "  - Tempo:      http://localhost:3200"
echo ""
echo "First time? Open Grafana → Dashboards → Edge Functions Overview."
echo "If panels are empty, invoke an edge function to generate traffic, e.g.:"
echo "  curl -i http://localhost:54321/functions/v1/healthz"
echo ""
echo "To stop:           ./scripts/stop-observability.sh"
echo "To stop + wipe:    ./scripts/stop-observability.sh --clean"
echo ""
