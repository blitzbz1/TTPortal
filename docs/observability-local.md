# Observability — local quickstart

A local Grafana stack mirrors what production sends to Grafana Cloud. Use it to verify Edge Function instrumentation before pointing at Cloud.

## Prerequisites

- Docker Desktop running
- Supabase CLI started: `npx supabase start` (so the `supabase_edge_runtime_*` container is up for Promtail to scrape)

## Start

```bash
./scripts/start-observability.sh
```

That brings up: Prometheus (`:9090`), Loki (`:3100`), Promtail, Tempo (`:3200`), the OTel Collector (`:4317`/`:4318`), and Grafana (`:3001`, admin/admin).

Stop with:

```bash
./scripts/stop-observability.sh           # keep volumes
./scripts/stop-observability.sh --clean   # wipe volumes
```

## Verify

1. Hit the public healthz to generate a request:

   ```bash
   curl -i http://localhost:54321/functions/v1/healthz
   ```

2. Open Grafana at <http://localhost:3001> (admin/admin).
3. Go to **Dashboards → Edge Functions Overview**. You should see a tick on the request rate panel within ~30s.
4. Open **Dashboards → Logs Explorer** to see the structured log line.
5. Open **Dashboards → Traces** to see the span and the latency histogram populate.

## How the pieces wire up

```
Edge Function (Deno)
  │
  ├── stdout JSON  ──→  Promtail (Docker SD)  ──→  Loki  ──→  Grafana
  │
  └── OTLP/HTTP   ──→  OTel Collector         ──→  Tempo ──→  Grafana
                       │
                       └── spanmetrics connector ──→  Prometheus ──→  Grafana
```

`withTiming` (in `supabase/functions/_shared/logger.ts`) emits one structured access log per request and one OTLP span per request. Locally, Promtail picks up logs from the `supabase_edge_runtime_*` Docker container; the OTel Collector receives spans on `host.docker.internal:4318` (the default endpoint when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset).

## Common queries (LogQL)

```logql
# All edge function requests last 5 min
{job="supabase_edge_functions", type="request"}

# Errors, grouped by function
sum by (function) (count_over_time({job="supabase_edge_functions", level="error"}[5m]))

# p95 latency from access logs
quantile_over_time(0.95,
  {job="supabase_edge_functions", type="request"} | json | unwrap data_duration_ms [5m]) by (function)

# Find logs for a specific trace
{job="supabase_edge_functions"} |= "<trace-id>"
```

## Known gotchas (carry over from `gathering`)

- **Promtail JSON parsing.** Edge Runtime prefixes lines with `[Info] {...}`. The pipeline strips that with a regex stage before the JSON parser — see `docker/observability/promtail/promtail-config.yml`. If a panel goes empty after a Promtail config edit, restart the container; macOS Docker Desktop can cache bind-mounted files.
- **Spans appear before tag-based search.** Tempo's tag-based search (`service_name`) may show empty for ~30s after a fresh start. Search by trace ID directly in the meantime.
- **Spanmetrics histogram bucket name.** The Prometheus metric is `otelcol_edge_functions_duration_milliseconds_bucket` — the connector adds the unit suffix.
- **Grafana login lockout.** `GF_SECURITY_LOGIN_MAXIMUM_INVALID_LOGIN_ATTEMPTS: 0` is set in `docker-compose.yml` so dev typos don't lock you out for 5 minutes.

## What this stack does NOT cover

- Postgres metrics — deferred to v2 (requires Supabase Pro for the Metrics Endpoint, or a custom edge cron).
- Client-side errors — no Sentry yet. Browser/RN errors only land in console for now.
- Cron job tracking, push pipeline, egress monitoring — see `monitoring.md` Phase 5.
