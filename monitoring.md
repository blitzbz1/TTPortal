# TTPortal Monitoring & Tracing Plan

> Status: **Draft v0.1**, 2026-05-07. Owner: tavig. Pre-implementation — review before kicking off Phase 0.

A staged plan to add observability to the TTPortal app (Expo/RN client + Supabase backend) using **open-source tooling** with a **<$10/month** baseline. The plan is greenfield: no monitoring exists today beyond `console.*` calls in `src/lib/logger.ts`, and the recent Realtime egress incident (see `postmortem.md`) is the proximate motivation.

A working reference exists in the sibling `gathering` project (`/Users/tavi/Projects/gathering/`) — same Expo + Supabase shape, same constraints, fully wired up. **This plan is mostly "do what `gathering` did, adapted to TTPortal's specific surfaces."** Where it diverges, the divergence is called out and justified.

---

## Table of contents

1. [Why this exists](#1-why-this-exists)
2. [Goals & non-goals](#2-goals--non-goals)
3. [Constraints](#3-constraints)
4. [What needs monitoring (TTPortal-specific)](#4-what-needs-monitoring-ttportal-specific)
5. [Stack selection](#5-stack-selection)
6. [Architecture](#6-architecture)
7. [Phased rollout](#7-phased-rollout)
8. [Per-component instrumentation plans](#8-per-component-instrumentation-plans)
9. [Dashboards](#9-dashboards)
10. [SLOs & alerting](#10-slos--alerting)
11. [Cost model](#11-cost-model)
12. [Migration: local → Grafana Cloud Free](#12-migration-local--grafana-cloud-free)
13. [Operational gotchas (carry-over from `gathering`)](#13-operational-gotchas-carry-over-from-gathering)
14. [Open questions / future work](#14-open-questions--future-work)
15. [File layout](#15-file-layout)
16. [Appendix A: Sample queries](#appendix-a-sample-queries)
17. [Appendix B: Alternative stacks considered](#appendix-b-alternative-stacks-considered)

---

## 1. Why this exists

The Apr 28 – May 1, 2026 Realtime egress incident (`postmortem.md`) burned through the Supabase free-tier egress allocation in four days, undetected for ~96 hours, on a project with 3–4 active users. The cause was a per-row WAL fan-out from a published table; the *detection latency* was the real problem. The fix landed; the **monitoring gap** that allowed it to fester for four days has not.

The next class of incident will look different. We need:

- A way to notice errors and 5xx spikes within minutes, not days.
- Per-route latency and request-rate visibility so we can tell "deploy made it slower" before users report it.
- Pg_cron job health — currently silent failures.
- An **egress / cost early warning** that does not depend on opening the Supabase dashboard.
- A single place to look during an incident (Grafana) instead of tailing Supabase logs by hand.

This document plans the build-out, in priority order, with budget-aware tooling choices.

---

## 2. Goals & non-goals

### Goals

- **Detect** new errors, regressions, and SLO breaches within ≤ 5 min of deploy.
- **Triage** an incident without a separate trip to Supabase / Vercel / Expo dashboards. One Grafana, one Sentry, done.
- **Quantify** request volume, latency, error rate per Edge Function and per route — enough to make data-driven optimization calls.
- **Correlate** logs ↔ traces ↔ metrics by `trace_id` and `request_id`.
- **Catch the next egress spike** before billing does — within 24h of onset.
- **Stay portable**: instrumentation in OpenTelemetry / Sentry SDKs so we are not locked to a vendor.

### Non-goals (for v0.1)

- Real User Monitoring (RUM) for the mobile client beyond Sentry's session tracking. (Future, if traction warrants.)
- Continuous profiling (Pyroscope) — defer until we have a perf complaint we can't explain with traces.
- eBPF auto-instrumentation (Beyla) — overkill at this scale.
- Synthetic monitoring across the funnel (sign-up → checkin → notification). Add when there is paying traffic.
- Business / product analytics (PostHog, Amplitude). Different problem; do not conflate.
- Mobile crash symbolication beyond what Sentry provides out of the box.

---

## 3. Constraints

| Constraint | Implication |
|---|---|
| **Single-engineer maintenance** | Prefer managed (Grafana Cloud Free, Sentry Developer) over self-hosted in production. Local dev = Docker stack. |
| **<$10/month sustained spend** | Free tiers only at the current scale. Self-hosted backup is a $5/mo VPS if a vendor falls over. |
| **Supabase Edge Runtime quirks** | Official OTel SDKs don't behave well there (see `gathering/supabase/functions/_shared/otel.ts` — hand-rolled exporter required). Re-use that. |
| **Pre-revenue, pre-launch** | Telemetry must never delay the user-visible response. Fire-and-forget on the hot path. |
| **Expo OTA + EAS Build pipeline** | Sentry source maps must be uploaded by the EAS build hook; release names tie to `expo.version`. |
| **No Kubernetes** | Docker Compose for local; Grafana Cloud or Supabase-hosted for prod. No need for Helm / k8s operators. |
| **No PII leakage** | All client logs and Sentry events go through a `beforeSend`/sanitizer that scrubs auth headers, tokens, email patterns. |

---

## 4. What needs monitoring (TTPortal-specific)

These are the surfaces that warrant first-class instrumentation, not a generic checklist. Pulled from `src/`, `supabase/`, and `postmortem.md`.

### 4.1 Edge Functions

| Function | Path | Risk | What to capture |
|---|---|---|---|
| `send-app-invite` | `supabase/functions/send-app-invite/` | Loops over paginated `auth.admin.listUsers` to find existing accounts — unbounded latency at scale | Span per request, paged-fetch count, invite success/fail per email |
| `amatur-proxy` | `supabase/functions/amatur-proxy/` | External upstream (Amatur API) — latency and outage exposure | Span per request, upstream status code, upstream latency, payload size |

### 4.2 PostgREST routes (Supabase auto-generated)

We don't own the gateway code, but we own the SQL it executes. Hot paths to watch:

- `POST /rest/v1/notifications` — fan-out target; the egress incident's epicentre
- `DELETE /rest/v1/notifications?id=eq.*` and bulk delete on `markAllAsRead`
- `POST /rest/v1/checkins` — triggers `send_checkin_notification` fan-out; per-row push
- `POST /rest/v1/friendships` — triggers two fan-out notifications
- `POST /rest/v1/events` and `DELETE /rest/v1/events` (cascade across 11 child tables)
- The two-step query pattern (services like `getFriends`, `getNotifications`, `getEventParticipants`, `getVenues`) — N+1 risk, batch sizes worth tracking

PostgREST does not emit OTLP. We instrument by:
1. **Postgres-level**: `pg_stat_statements` + `postgres_exporter` + Supabase log forwarder.
2. **Client-level**: wrap the Supabase JS client in a thin tracer that emits a span per call (Phase 4).

### 4.3 pg_cron jobs

| Job | Schedule | What can go wrong |
|---|---|---|
| `cleanup_old_notifications` | hourly :30 | The job that triggered the egress incident. Mass DELETE → published-table fan-out (since fixed). Still: long runtime, lock contention. |
| `generate_recurring_events` | hourly :15 | Push-volume multiplier; one cancelled recurring series can fan thousands of pushes. |
| `send_event_reminders` | hourly :00 | Push delivery failures, Expo API rate limit, token churn. |
| `request_event_feedback` | hourly :45 | Same as reminders. |
| `action_log` cleanup | tbd | Currently unenforced — table-bloat risk. |
| Materialized view refresh (`refresh_stats`) | tbd | Stale leaderboards if it stops; long lock if it runs concurrent with writes. |

Currently **none** of these emit success/failure signals to anywhere we can see. This is the single biggest blind spot.

### 4.4 Push notifications pipeline

Flow: DB trigger → `send_push_notification()` → `pg_net.http_post()` → Expo Push API. Failure modes: invalid token (uninstalled app), opted-out, Expo API 5xx, `pg_net` queue saturation.

- Today: zero visibility. We don't even know if pushes are landing.
- Plan: write every send attempt to a `push_metrics` table (insert-on-trigger), label with `(trigger_name, recipient_id, status, expo_response_code, latency_ms)`. Dashboard reads this table.

### 4.5 Auth flows

Three OAuth paths (email/password, Google, Apple) plus session restoration from `expo-sqlite` (native) / `localStorage` (web). We want:
- Sign-up completion rate (verification rate)
- Sign-in success/failure by method
- Session restoration failures (often a leading indicator of broken updates)
- OAuth token refresh failures

Tracked via Sentry breadcrumbs + custom transactions on the client side.

### 4.6 Offline queue

`OfflineQueueProvider` (`src/contexts/`) buffers mutations during network loss. Health questions:
- Queue depth distribution (P50 / P95)
- Mean queue age (how stale before we sync)
- Sync success rate vs. retry count
- Network availability transitions per user-session

Reported as Sentry custom measurements + structured logger events (Phase 2).

### 4.7 Rate limiting

`action_log` + `rate_limit_config` (migration 047). We want:
- 429 rate per route
- Top violators (per-user and per-IP)
- False-positive rate (admins / power users hitting limits unexpectedly)
- Rate-limit RPC failure rate (the "fail open" path)

The instrumentation comes free once Edge Functions emit OTLP — `http.response.status_code=429` filters give us most of it.

### 4.8 Egress / cost (the postmortem follow-up)

Supabase free tier does not expose a webhook. Plan: a **scheduled GitHub Action** (or a tiny Vercel cron) that hits the Supabase usage API daily, persists the values in a tiny SQLite/Postgres table, and **alerts to Slack/email when day-over-day delta exceeds 5×**, regardless of category (egress, db_size, storage, function_invocations). This closes the postmortem's "still recommended" item directly.

### 4.9 Realtime channels

Currently `public.notifications` is **out** of the publication. If we ever re-introduce realtime for any other table, we want to see it on a dashboard *before* it bills. Plan: a Postgres metric exporter that scrapes `pg_publication_tables` and `pg_replication_slots` so a dashboard panel shows "tables currently in the realtime publication" — a structural-change alarm.

### 4.10 Mobile-specific

| Signal | Source | Captured via |
|---|---|---|
| App-start time (cold/warm) | RN | Sentry transaction `app.start.cold` / `app.start.warm` (built-in) |
| Frame drops / slow renders | RN | Sentry `slow_frames` / `frozen_frames` (built-in) |
| Crash-free sessions | RN | Sentry sessions |
| Bundle size / TTI on web | Web | Sentry Web Vitals (LCP, INP, CLS) |
| Deep link failures | RN | Custom Sentry breadcrumb in `expo-router` deep link handler |
| Push-token registration failure | RN | Custom Sentry capture in `useNotifications` |

---

## 5. Stack selection

### Recommendation

| Layer | Tool | Why this, not alternatives |
|---|---|---|
| **Client errors & RUM** | **Sentry** (`@sentry/react-native`) | Best-in-class RN support, free tier (5k errors / 10k transactions / month), source-map upload integrated with EAS, ad-blocker tunnel pattern proven in `gathering/api/sentry.ts`. Self-hosted Sentry is heavyweight; **GlitchTip** is a cheaper Sentry-compatible alternative if free tier becomes insufficient. |
| **Backend traces** | **OpenTelemetry → Tempo** (local) → **Grafana Cloud Tempo** (prod) | OTel is the wire format; storage is interchangeable. Local Tempo for dev, Cloud Tempo Free for prod. |
| **Backend logs** | **Loki + Promtail** (local) → **Grafana Cloud Loki** (prod) | LogQL is the same as PromQL ergonomically; cheap storage (chunked by labels). 50 GB/mo free is comfortable. |
| **Backend metrics** | **Prometheus + postgres_exporter** (local) → **Grafana Cloud Prometheus** (prod) | Standard. Postgres exporter gives us ~200 metrics for free. |
| **Visualization** | **Grafana** (local & cloud) | Same UI both places. JSON-provisioned dashboards live in the repo. |
| **Pipeline** | **OTel Collector** (local only) | Local convenience: collects spans, derives RED metrics via `spanmetrics` connector. Skipped in prod — Grafana Cloud derives them. |
| **Job & uptime monitoring** | **Uptime Kuma** (self-hosted) OR **Better Uptime** free tier | Healthcheck pings, deadman switches for cron jobs. Kuma is a 50 MB Docker image. |
| **Cost / egress monitoring** | **GitHub Actions cron** (custom script) | No vendor for this — daily poll of Supabase usage API, alert on jump. |

### Why not these (briefly)

- **Datadog / New Relic / Honeycomb**: not OSS, not free at our scale.
- **SigNoz / HyperDX / OpenObserve**: all-in-one OSS APMs (ClickHouse-backed) — interesting, but more ops burden than Grafana Cloud's free tier and less mature React Native support. Re-evaluate if we ever want to fully self-host.
- **Grafana Alloy** (replaces Prometheus Agent + Promtail + OTel Collector in one binary): newer, attractive once stable. For v0.1 we mirror `gathering` (separate components) so the existing reference configs apply.
- **Elastic / OpenSearch**: heavy for 3–4 users.
- **AWS CloudWatch / GCP Logging**: not where our infra lives (Supabase + Vercel + EAS).

A fuller comparison is in [Appendix B](#appendix-b-alternative-stacks-considered).

---

## 6. Architecture

### 6.1 Data flow (production)

```
┌────────────────────────────┐         ┌───────────────────────────┐
│  Expo / RN / Web client    │  HTTPS  │  Sentry (lets-gather...)  │
│  (Sentry SDK + tunnel)     ├────────►│  Issues, transactions,    │
│                            │         │  performance, releases    │
└────────┬───────────────────┘         └───────────────────────────┘
         │ Supabase JS SDK
         ▼
┌────────────────────────────┐
│  Supabase (managed)        │
│  ┌──────────────────────┐  │  OTLP/HTTP    ┌──────────────────────┐
│  │ Edge Functions       ├──┼──────────────►│ Grafana Cloud Tempo  │
│  │  - send-app-invite   │  │               │ (traces)             │
│  │  - amatur-proxy      │  │               └──────────────────────┘
│  │  withTiming + logger │  │
│  │                      ├──┼──HTTP push───►┌──────────────────────┐
│  │                      │  │               │ Grafana Cloud Loki   │
│  └──────────────────────┘  │               │ (logs, JSON)         │
│  ┌──────────────────────┐  │               └──────────────────────┘
│  │ Postgres + pg_cron   │  │
│  │  - jobs, RLS, push   │  │  scrape       ┌──────────────────────┐
│  │  - /metrics endpoint ├──┼──────────────►│ Grafana Cloud Mimir  │
│  └──────────────────────┘  │  (60s)        │ (Prometheus metrics) │
└────────────────────────────┘               └──────────┬───────────┘
                                                         │
                                              ┌──────────▼──────────┐
                                              │ Grafana (Cloud UI)  │
                                              │ Dashboards, alerts  │
                                              │ TraceQL/LogQL/PromQL│
                                              └─────────────────────┘

┌────────────────────────────┐
│  GitHub Actions (cron)     │  daily   ┌─────────────────────────┐
│  scripts/check-usage.ts    ├─────────►│  Slack webhook / email  │
│  (egress / cost guard)     │          │  on >5× day-over-day    │
└────────────────────────────┘          └─────────────────────────┘

┌────────────────────────────┐
│  Uptime Kuma (Docker, $5   │  ping  ┌────────────────────────┐
│  VPS or fly.io free)       ├───────►│ Edge Function /health  │
│                            │        │ Supabase REST root     │
│                            │        │ Web app static URL     │
└────────────────────────────┘        └────────────────────────┘
```

### 6.2 Data flow (local dev)

Same as `gathering`'s `docker/observability/`: Edge Functions push OTLP/HTTP to a local **OTel Collector**, which forwards to a local **Tempo** and derives **spanmetrics** for local **Prometheus**. **Promtail** tails Supabase Edge Runtime stdout via Docker SD into local **Loki**. **postgres-exporter** scrapes the local Supabase Postgres. **Grafana** at `localhost:3001`.

Local dev requires no credentials. Production requires three Edge Function secrets (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `GRAFANA_CLOUD_LOKI_*`).

### 6.3 Correlation strategy

Every request through `withTiming` produces:
- a span with `trace_id` (W3C trace context, 32-hex)
- a structured log line with `trace_id` field, `level`, `function`, `route`
- an entry in spanmetrics (`{http_route, http_method, http_response_status_code}`)

Grafana datasource config wires:
- Loki → Tempo (clicking a `trace_id` in a log opens the trace)
- Tempo → Loki (a trace's "logs" tab queries `{trace_id="..."}`)
- Tempo → Prometheus (RED metrics linked from a span)

Sentry separately stores its own `event_id` per error; we add `trace_id` as a Sentry tag in the Edge Functions so a Sentry issue can be cross-referenced into Grafana.

---

## 7. Phased rollout

Six phases, total ~3–5 engineering weeks (calendar) at part-time pace. Each phase is independently shippable and observable in production after merge.

### Phase 0 — Foundation (1–2 days)

**Outcome:** healthchecks live, uptime monitoring live, no app code changes shipped to users yet.

- [ ] Add `/healthz` to **both** Edge Functions (`send-app-invite`, `amatur-proxy`). Returns 200 + `{ok: true, version, ts}`. No DB call (cheap, doesn't trip rate limits).
- [ ] Add a `/health/db` Edge Function that runs `SELECT 1` against Postgres. Used by deeper Uptime Kuma checks.
- [ ] Stand up **Uptime Kuma** on a $5 VPS (or fly.io free machine). Add four monitors:
  - Edge `/healthz` for each function (1-min interval)
  - Supabase REST root (`/rest/v1/?apikey=anon`) (5-min interval)
  - Web app URL (whatever Vercel / GH Pages serves) (5-min interval)
  - Supabase `https://<ref>.supabase.co/auth/v1/health` (5-min interval)
- [ ] Configure Slack webhook on Kuma → `#alerts`.
- [ ] Document the 4 URLs + the Slack channel in `monitoring.md` (this file's "Operational" section once built).

**Definition of done:** Kuma dashboard public-readable; first heartbeat captured. Page someone if any of the 4 monitors flatlines for 3 consecutive failures.

### Phase 1 — Errors (Sentry, both client and Edge Functions) (2–3 days)

**Outcome:** every uncaught exception in the RN app and Edge Functions surfaces in Sentry within seconds, with release tags, breadcrumbs, and source maps.

- [ ] Create `react-native` Sentry project under the `lets-gather` org (or new org). Capture DSN.
- [ ] Install `@sentry/react-native@latest`. Init in `src/app/_layout.tsx`:
  - `tracesSampleRate: __DEV__ ? 1.0 : 0.1`
  - `profilesSampleRate: 0.1`
  - `enableAutoSessionTracking: true`
  - `release: 'ttportal@' + Constants.expoConfig.version + '+' + Constants.expoConfig.runtimeVersion`
  - `dist: Updates.updateId ?? 'native'`
- [ ] Add `beforeSend` filter mirroring `gathering/src/constants/sentry-filters.ts`: drop "Network request failed", "AbortError", "cancelled"; scrub `authorization`, `cookie`, `apikey`, `x-api-key` headers.
- [ ] Add Sentry tunnel for web only: `api/sentry.ts` Vercel Edge function (verbatim port from `gathering/api/sentry.ts` works) — bypasses ad blockers blocking `*.ingest.sentry.io`.
- [ ] EAS build hook for source-map upload (use `@sentry/react-native/dist/js/tools/sentryUpload.gradle` for Android; `sentry-cli` invocation in `eas.json` post-build hook for iOS + web).
- [ ] Edge Function Sentry: skip the official Deno SDK (heavy / unreliable in Edge Runtime). Instead, post errors directly to Sentry's store endpoint from `_shared/logger.ts`'s error path. ~30 lines, fire-and-forget.
- [ ] Enable Sentry alert rules: new issue, regression, error spike (>10× baseline), high-priority. Wire to Slack.

**Definition of done:** Throwing an error in `_layout.tsx` produces a Sentry issue within 30s with a sourcemap-resolved stack and the current release name.

### Phase 2 — Structured logs (Edge Functions → Loki) (3–4 days)

**Outcome:** every Edge Function request emits a structured access log with `trace_id`, queryable in Grafana via LogQL, with a `withTiming` middleware ready for Phase 4 traces.

- [ ] Create `supabase/functions/_shared/logger.ts` — port `gathering`'s. Provides `createLogger(name)`, `withTiming(route, handler)`, module-level `log()`.
- [ ] Stand up local Docker observability stack — `docker/observability/` directory with Loki, Promtail, Grafana, Prometheus, Tempo, OTel Collector, postgres-exporter. **Copy `gathering/docker/observability/` wholesale**, change Promtail's `__meta_docker_container_label_com_supabase_cli_project` filter to `ttportal-supabase` (or whatever `supabase/config.toml` sets `project_id` to).
- [ ] Add `scripts/start-observability.sh` and `scripts/stop-observability.sh`.
- [ ] Wrap both existing Edge Functions in `withTiming`:
  - `send-app-invite/index.ts`: `serve(withTiming('send-app-invite', handler))`
  - `amatur-proxy/index.ts`: same
- [ ] Add Grafana Cloud account, generate Loki push token, set `GRAFANA_CLOUD_LOKI_USER` / `GRAFANA_CLOUD_LOKI_TOKEN` Supabase secrets. Logger pushes when env vars set; falls through to stdout-only when not.
- [ ] First dashboard: `logs-explorer.json` (port from `gathering`).

**Definition of done:** Hitting `send-app-invite` produces a JSON log line in Grafana Cloud Loki within 10s, queryable as `{job="supabase_edge_functions", function="send-app-invite"}`.

### Phase 3 — Postgres metrics (4–5 days)

**Outcome:** Postgres health visible in Grafana — connections, txn rate, cache hit ratio, deadlocks, slow queries.

- [ ] Local: `postgres-exporter` already in the Phase 2 docker-compose. Add scrape job to local Prometheus.
- [ ] Production: enable Supabase's **Metrics Endpoint** (`/customer/v1/privileged/metrics`). Service-role-key auth.
- [ ] Configure the scrape in **Grafana Cloud Connections → Metrics Endpoint** UI. (Cloud-side, no code.)
- [ ] Enable `pg_stat_statements` in Supabase (extension toggle). Add a scheduled query that snapshots top-N slow queries to a `slow_query_log` table for trending.
- [ ] Dashboards: `postgres-health.json` (port from `gathering`) + a custom **slow-query** panel reading `slow_query_log`.
- [ ] Alert: cache hit ratio < 90% sustained for 30 min → Slack.

**Definition of done:** Postgres dashboard has live data; slow-query table populates.

### Phase 4 — Distributed tracing (4–5 days)

**Outcome:** every Edge Function request and every important client interaction produces a span; latency percentiles visible per route; trace ↔ log correlation works.

- [ ] Port `supabase/functions/_shared/otel.ts` from `gathering` (the hand-rolled OTLP exporter — see [§13.2](#132-edge-runtime-isolate-lifecycle) for why). Update `service.name` resource attribute to `ttportal-edge`.
- [ ] Update `withTiming` to start/end a span around each request (already in `gathering`'s logger.ts).
- [ ] Local: spans flow to local OTel Collector → local Tempo. Spanmetrics connector derives RED metrics into local Prometheus.
- [ ] Production: spans flow OTLP/HTTP straight to Grafana Cloud Tempo gateway. Cloud derives RED metrics natively (no Collector).
- [ ] Configure `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` Supabase secrets.
- [ ] Client-side: enable Sentry's `tracingOrigins` for Supabase URL so Supabase JS calls become child spans of UI transactions. Optional: a thin `withQueryTrace(label, fn)` wrapper around hot service calls (`getNotifications`, `getFeed`, `getEventParticipants`) emitting a Sentry span.
- [ ] Wire Grafana datasource correlations: Loki → Tempo (derived field on `trace_id`), Tempo → Loki (logs tab), Tempo → Prometheus (RED metrics).
- [ ] Dashboards: `edge-functions-overview.json`, `traces-overview.json`.

**Definition of done:** Open a trace in Tempo, click "logs" → see the matching log lines from Loki. Click "metrics" → see the route's RED graph in Prometheus.

### Phase 5 — Custom signals (cron, push, offline, egress, realtime guard) (4–5 days)

**Outcome:** the TTPortal-specific concerns from §4 light up.

- [ ] **Cron job tracking**: create `cron_run_log` table:
  ```sql
  create table cron_run_log (
    id bigserial primary key,
    job_name text not null,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    status text check (status in ('success','error','running')),
    rows_affected int,
    duration_ms int,
    error text
  );
  ```
  Wrap each cron-invoked function in a `with_run_log()` SQL helper that inserts on entry, updates on exit. Dashboard: `cron-jobs.json` reading from this table via Grafana's Postgres datasource (or via a metric exporter that scrapes it). Alert: any `status='error'` OR no run within `interval + 10min`.
- [ ] **Push pipeline**: add a `push_metrics` table:
  ```sql
  create table push_metrics (
    id bigserial primary key,
    sent_at timestamptz not null default now(),
    trigger_name text,
    recipient_id uuid,
    expo_status_code int,
    expo_response jsonb,
    latency_ms int
  );
  ```
  Update `send_push_notification()` to write here on every Expo Push API call. Dashboard panels: send rate, success ratio, latency histogram, top failing trigger. Alert: success ratio < 95% over 1h.
- [ ] **Offline queue**: instrument `OfflineQueueProvider` to emit a Sentry custom measurement on every flush: `offline.queue.depth`, `offline.queue.oldest_age_ms`, `offline.flush.success`, `offline.flush.retries`. Sentry "Performance Issues" surfaces regressions.
- [ ] **Egress monitor**: GitHub Action `.github/workflows/egress-check.yml`, runs daily at 06:00 UTC. Calls Supabase Management API (`/v1/projects/{ref}/usage`), persists to a small JSON gist or repo file (since we have no DB-side access scope), compares to yesterday, posts to Slack if ratio > 5× in any category. ~80 LoC of TS.
- [ ] **Realtime publication guard alarm**: add a Prometheus collector exporter scraping `select schemaname,tablename from pg_publication_tables where pubname='supabase_realtime'`. Alert on **any change** in the row set. (Tables added or removed.) Backstops migration 055's event-trigger guard with a monitoring layer.
- [ ] **Auth flow signals**: emit Sentry breadcrumbs from `SessionProvider`'s sign-in / sign-up / session-restore paths with method tag (`google`, `apple`, `email`). Sentry's funnel view does the rest.

**Definition of done:** Trigger a manual `cleanup_old_notifications` run — see it appear in the Cron Jobs dashboard within 60s. Send a test push — see it tick the success counter. Bump Supabase egress on staging by 6× — see the Slack alert next morning.

### Phase 6 — SLOs and alerts (ongoing, but a 1-week initial pass)

**Outcome:** named SLOs with error budgets, an alert taxonomy, runbook linked from each alert.

See [§10](#10-slos--alerting).

---

## 8. Per-component instrumentation plans

### 8.1 React Native client (Sentry)

**Init shape** (in `src/app/_layout.tsx`, before any other provider):

```ts
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { SENTRY_DROP_PATTERNS, SENSITIVE_HEADERS } from '@/constants/sentry-filters';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !__DEV__ || process.env.EXPO_PUBLIC_SENTRY_FORCE === '1',
  release: `ttportal@${Constants.expoConfig?.version}+${Constants.expoConfig?.runtimeVersion ?? 'native'}`,
  dist: Updates.updateId ?? Constants.expoConfig?.android?.versionCode?.toString() ?? '0',
  environment: process.env.EXPO_PUBLIC_ENV ?? 'production',
  tracesSampleRate: __DEV__ ? 1.0 : 0.1,
  profilesSampleRate: 0.1,
  enableAutoSessionTracking: true,
  attachScreenshot: false, // PII risk; turn on per-issue if needed
  attachViewHierarchy: true,
  beforeSend(event) {
    const msg = event.message ?? event.exception?.values?.[0]?.value ?? '';
    if (SENTRY_DROP_PATTERNS.some(p => p.test(msg))) return null;
    scrubHeaders(event, SENSITIVE_HEADERS);
    return event;
  },
  integrations: [
    Sentry.reactNativeTracingIntegration({
      shouldCreateSpanForRequest: (url) =>
        url.includes(SUPABASE_URL) || url.includes('expo.host'),
    }),
  ],
});
```

**Web tunnel**: a Vercel Edge function at `api/sentry.ts` accepts envelopes, validates the DSN, forwards to `*.ingest.sentry.io`. Verbatim port from `gathering/api/sentry.ts`.

**Source maps**: in `eas.json`, post-build hook runs `sentry-cli sourcemaps upload --release=$RELEASE dist/`. For native, use Sentry's Gradle / xcodebuild plugins.

### 8.2 Edge Functions

**Per-function shape:**

```ts
// supabase/functions/send-app-invite/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { withTiming, log } from '../_shared/logger.ts';

serve(withTiming('send-app-invite', async (req) => {
  log.info('invite_received', { email_domain: extractDomain(emailFromBody) });
  // ... handler body unchanged ...
  return new Response(...);
}));
```

`withTiming` (port from `gathering/supabase/functions/_shared/logger.ts`):
- starts an OTLP span with HTTP semantic-convention attributes
- generates a `request_id` (UUID v7)
- sets `activeTraceId` module-var so log() picks it up
- on response: sets `http.response.status_code`, ends span, emits one access-log line `{type: "request", duration_ms, status, route}`
- calls `flushNow()` (awaited locally; via `EdgeRuntime.waitUntil()` in prod) before response returns
- on exception: records exception on span, emits error log, re-throws

`_shared/otel.ts` (port from `gathering/supabase/functions/_shared/otel.ts`): hand-rolled OTLP/HTTP exporter. ~200 LoC, no external imports beyond `fetch` + `crypto`. See [§13.2](#132-edge-runtime-isolate-lifecycle) for the rationale.

### 8.3 Postgres / Supabase

**Local**: `postgres-exporter` container in `docker/observability/docker-compose.yml`, scrape job in `prometheus.yml`.

**Production**: enable Supabase's Metrics Endpoint (Connections → Metrics Endpoint in the dashboard). Configure scrape in Grafana Cloud (UI). No code.

**Slow queries**: enable `pg_stat_statements` extension. Schedule (pg_cron):
```sql
insert into slow_query_log (queryid, query, calls, mean_time_ms, total_time_ms, rows, captured_at)
select queryid, query, calls, mean_exec_time, total_exec_time, rows, now()
from pg_stat_statements
where mean_exec_time > 100  -- ms
order by mean_exec_time desc
limit 50;
```
Run every 30 min. Dashboard reads via Grafana's Postgres datasource.

**RLS profiling** (deferred — Phase 5 nice-to-have): enable `auto_explain` for queries > 500ms with `auto_explain.log_min_duration = '500ms'` and `auto_explain.log_analyze = true`. Output goes to Postgres logs → Loki via Supabase log forwarder.

### 8.4 pg_cron jobs

Each job currently looks like:
```sql
select cron.schedule('cleanup-notifications-30min', '30 * * * *',
  $$delete from notifications where created_at < now() - interval '30 days'$$);
```

Refactor to:
```sql
create or replace function run_cleanup_old_notifications() returns void as $$
declare
  start_ts timestamptz := clock_timestamp();
  v_id bigint;
  v_rows int;
begin
  insert into cron_run_log (job_name, status) values ('cleanup_old_notifications', 'running')
    returning id into v_id;
  begin
    delete from notifications where created_at < now() - interval '30 days';
    get diagnostics v_rows = row_count;
    update cron_run_log set status='success', finished_at=now(),
      rows_affected=v_rows, duration_ms=extract(milliseconds from clock_timestamp()-start_ts)
      where id=v_id;
  exception when others then
    update cron_run_log set status='error', finished_at=now(),
      duration_ms=extract(milliseconds from clock_timestamp()-start_ts), error=sqlerrm
      where id=v_id;
    raise;
  end;
end;
$$ language plpgsql;

select cron.schedule('cleanup-notifications-30min', '30 * * * *',
  $$select run_cleanup_old_notifications()$$);
```

Apply this pattern to all five cron jobs. The `cron_run_log` table is the single source of truth for the Cron Jobs dashboard.

### 8.5 Push pipeline

Edit `send_push_notification()` (in `supabase/migrations/009_notification_triggers.sql`) to insert into `push_metrics` after each `pg_net.http_post`:

```sql
insert into push_metrics (trigger_name, recipient_id, expo_status_code, expo_response, latency_ms)
values (TG_NAME, recipient_id, http_status, http_response, duration_ms);
```

(Will need a small helper since `pg_net` is async — capture status from the response queue. Pattern: a follow-up job reads `net.http_response_queue` and back-fills `push_metrics` rows by request id.)

### 8.6 Offline queue

In `OfflineQueueProvider`:
```ts
import * as Sentry from '@sentry/react-native';

function reportQueueHealth(queue: Mutation[]) {
  Sentry.metrics.distribution('offline.queue.depth', queue.length);
  Sentry.metrics.distribution(
    'offline.queue.oldest_age_ms',
    queue.length ? Date.now() - queue[0].queuedAt : 0,
  );
}
```

Call after every enqueue and after every flush attempt. Sentry stores these as custom measurements; the Sentry "Insights" UI surfaces regressions.

### 8.7 Egress monitor (GitHub Action)

`.github/workflows/egress-check.yml`:
```yaml
name: Egress check
on:
  schedule: [{cron: '0 6 * * *'}]
  workflow_dispatch:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: 20}
      - run: npx tsx scripts/check-supabase-usage.ts
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF:  ${{ secrets.SUPABASE_PROJECT_REF }}
          SLACK_WEBHOOK:         ${{ secrets.SLACK_WEBHOOK }}
```

`scripts/check-supabase-usage.ts` — fetches `https://api.supabase.com/v1/projects/{ref}/usage`, persists yesterday's snapshot to `.usage-history.json` (committed), compares per-category, posts to Slack on ≥ 5× delta. Initial threshold; tune after observing baseline.

---

## 9. Dashboards

Five dashboards, all JSON-provisioned, all live in `docker/observability/grafana/dashboards/`. Same five as `gathering` — no need to redesign.

| Dashboard | Primary panels | Datasource |
|---|---|---|
| **Overview / NOC** | Edge fn RPS, error rate, p95 latency by route; Postgres up; today's egress; cron jobs status board | mixed |
| **Edge Functions** | RED metrics per route (rate, errors, duration), top errors table, recent slow traces table | Tempo + Loki |
| **Postgres Health** | Connections by state, txn/s, cache hit ratio gauge, deadlocks, top slow queries table | Prometheus + Postgres |
| **Logs Explorer** | Error/warn rate over time, browsable streams, free-text search | Loki |
| **Cron Jobs** | Status board (last run / next run / status), per-job duration histogram, error rate, push pipeline success ratio | Postgres |

A sixth dashboard, **Realtime / Cost guard**, is added for TTPortal specifically (the postmortem's lesson):

- Tables currently in `supabase_realtime` publication (single-stat, alarm if changes)
- Daily egress per category (line chart, last 30 days)
- Day-over-day delta (single-stat, color thresholds)
- pg_net queue depth (`select count(*) from net.http_request_queue`)

Sentry has its own UI for client-side; we link to the most-used queries from the Overview dashboard rather than rebuild Sentry inside Grafana.

---

## 10. SLOs & alerting

### 10.1 SLOs (initial, conservative — tighten with data)

| SLO | Target | Window | Source |
|---|---|---|---|
| Edge Function availability (non-5xx) | 99.5% | 30 days | spanmetrics 2xx-4xx ratio |
| Edge Function p95 latency (`send-app-invite`) | < 1500 ms | 30 days | spanmetrics histogram |
| Edge Function p95 latency (`amatur-proxy`) | < 3000 ms | 30 days | (upstream-bound, looser) |
| App crash-free sessions | 99.0% | 7 days | Sentry sessions |
| Push delivery success | ≥ 95% | 7 days | `push_metrics` |
| Cron job timeliness | each job runs within `interval + 10m` of schedule | per-run | `cron_run_log` |
| Egress day-over-day | ≤ 5× | daily | usage API |

### 10.2 Alerts

Severity ladder:

- **P1 (page)**: SLO error budget exhausted; Postgres unreachable; Edge Functions 5xx > 50% for 5 min; egress > 5× DoD; client crash-free < 95% for 1h.
- **P2 (Slack ping, no page)**: any cron job missed its schedule; push success < 95% for 1h; cache hit ratio < 90% for 30m; new Sentry issue with high event count; Realtime publication membership changed.
- **P3 (Slack info channel)**: deploys, releases, slow-query digest summary (daily), egress daily summary.

Alerts live in:
- **Grafana Cloud** (`grafana-cloud/alerts/*.json`) — backend: edge functions, postgres, cron, egress.
- **Sentry** (`sentry/alerts/*.json`) — client: crashes, regressions.
- **Uptime Kuma** — synthetic ping failures.

Each alert ships with a `runbook_url` annotation linking to a section in `docs/runbooks/<alert>.md` (TBD).

---

## 11. Cost model

| Item | Free tier covers | Paid trigger | Estimated paid cost |
|---|---|---|---|
| **Sentry Developer** | 5k errors + 10k transactions / month | High-traffic launch | $26/mo Team plan covers 50k errors |
| **Grafana Cloud Free** | 10k metric series, 50 GB logs/mo, 50 GB traces/mo, 14-day retention | Doubling user count | Pro starts at $19/user/mo (we'd hit limits before users) |
| **Uptime Kuma** | Self-hosted; $5/mo VPS or fly.io free | — | $5/mo realistic |
| **GitHub Actions egress check** | Free public repo / 2k min/mo private | — | $0 |
| **Supabase Metrics Endpoint** | Pro plan only | We're on Free → upgrade required for prod metrics | $25/mo Supabase Pro (separate from monitoring spend) |
| **Self-hosted local stack** | Dev only | — | $0 (runs on dev machines) |

**Realistic monthly bill for production at current scale:** $5 (Kuma VPS) **if** Supabase stays on Free. If/when we move to Supabase Pro for the Metrics Endpoint and other reasons, that's a $25/mo Supabase line item — which is a Supabase decision, not a monitoring decision. Alternative: keep Supabase Free and rely on Edge Function-side queries (`select * from pg_stat_*`) emitted as Prometheus textfile via a small Edge cron — cheaper but more code to maintain.

**Total dedicated monitoring spend:** $0 to $5/mo for v0.1.

---

## 12. Migration: local → Grafana Cloud Free

Mirror `gathering/docs/observability-cloud.md` step-for-step. Key actions:

1. Create Grafana Cloud stack (`ttportal.grafana.net`).
2. Create access policy `observability-write` with `metrics:write` + `logs:write` + `traces:write`. Mint one token.
3. Set Supabase Edge Function secrets:
   ```bash
   npx supabase secrets set \
     OTEL_EXPORTER_OTLP_ENDPOINT="https://otlp-gateway-prod-eu-west-2.grafana.net/otlp" \
     OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic%20<base64(instanceId:token)>" \
     GRAFANA_CLOUD_LOKI_USER="<loki_user_id>" \
     GRAFANA_CLOUD_LOKI_TOKEN="<token>"
   ```
4. In Grafana Cloud, configure **Connections → Metrics Endpoint** to scrape Supabase's `/customer/v1/privileged/metrics`.
5. Import Cloud dashboards: `grafana-cloud/dashboards/*.json` (datasource UIDs swapped for `grafanacloud-ttportal-*`).
6. Import alert rules: `grafana-cloud/alerts/*.json`.
7. Verify trace ↔ log correlation in Cloud Grafana Explore.

No Edge Function code change between local and Cloud — only env vars.

---

## 13. Operational gotchas (carry-over from `gathering`)

These are real lessons documented in `gathering/monitoring.md`. Including them here so we don't re-discover them.

### 13.1 Promtail's JSON parsing of Edge Runtime logs

Supabase Edge Runtime prepends each line with `[Info] ` or `[Error] `. Promtail config needs a regex stage **before** the JSON stage:

```yaml
- regex:
    expression: '^\[\w+\]\s+(?P<json_msg>\{.*\})\s*$'
- json:
    expressions: { level: level, function: function, type: '"data".type' }
    source: json_msg
```

### 13.2 Edge Runtime isolate lifecycle

Supabase Edge Runtime tears down isolates between requests, breaking `BatchSpanProcessor`'s timer-driven flushes. Use **per-request flush** instead. In production, `EdgeRuntime.waitUntil(flushNow())` makes it zero-latency; locally it's awaited (~5–30 ms).

### 13.3 `spanmetrics` is a connector, not a processor (OTel Collector ≥ 0.85)

Configure under `connectors:`, reference in **both** the traces pipeline (as exporter) and the metrics pipeline (as receiver).

### 13.4 Spanmetrics histogram bucket name

The metric is `otelcol_edge_functions_duration_milliseconds_bucket`, **not** `_duration_bucket`. The connector adds the unit suffix.

### 13.5 Prometheus reload doesn't pick up bind-mounted config on macOS

After editing `prometheus.yml`, restart the Prometheus container — `POST /-/reload` reads cached file content under macOS Docker Desktop.

### 13.6 Grafana login lockout

5 failed logins → 5 min lockout. Disable for dev:
```yaml
GF_SECURITY_LOGIN_MAXIMUM_INVALID_LOGIN_ATTEMPTS: 0
```

### 13.7 Tempo block search latency

Fresh spans appear in `/api/search` within seconds, but tag-based search (`service_name`) may show empty for ~30s after Tempo start. Wait or query by trace ID directly.

### 13.8 Sentry tunnel for ad-blocker bypass

Web users on ad blockers will silently lose Sentry envelopes. The `/api/sentry` Vercel Edge tunnel mitigates this. Verify in incognito + ad-blocker.

### 13.9 Mobile source-map upload during EAS

Sentry's React Native plugin requires a build hook. iOS uses `sentry-cli` from the post-build script; Android uses the Sentry Gradle plugin. Test by `Sentry.captureException(new Error('test'))` from a built TestFlight / internal track and verify the stack trace resolves to source.

### 13.10 PII in logs and Sentry

Always run a `beforeSend` and a logger sanitizer. The default scrub-list:
`authorization`, `cookie`, `apikey`, `x-api-key`, `password`, `token`, `secret`, `email` (partial — keep domain only for analytics).

---

## 14. Open questions / future work

- **Continuous profiling** (Pyroscope, Sentry Profiling): defer until we have an unexplained perf complaint. Sentry's profiling at 10% sample is a cheap leading start.
- **eBPF auto-instrumentation** (Beyla): not worth it at this scale.
- **Synthetic checks** beyond Uptime Kuma: a Playwright script that signs up, checks in, leaves a review — runs hourly. Add when we have a paid cohort.
- **Distributed traces from RN client → Edge Function → Postgres**: wire the W3C trace-context header from Sentry → into Supabase JS → into the Edge Function's `withTiming` so you get one continuous trace from tap to DB. Worth doing in Phase 4.5 once Phase 4 is stable.
- **Log retention beyond 14 days**: Grafana Cloud Free is 14d. If we need quarterly trends, mirror to S3 / R2 (cheap) and rebuild a Grafana datasource on top. Defer until we need it.
- **Alert noise**: Sentry can be noisy. Add a quiet-hours rule (no pages 22:00–08:00 unless P1 + crash spike), and ratchet thresholds after first month of data.
- **Cost shock from cardinality**: every label combination in Prometheus is a series. Watch out for high-cardinality labels (user_id, session_id). Keep `http.route` cardinality bounded; never label by user.
- **Cost of cron-on-trigger fan-out**: the `push_metrics` table will grow. Add a cleanup cron retaining 30 days.
- **Mobile log shipping**: client logs currently land only in Sentry breadcrumbs (60-event window). For deeper debugging, consider a dev-only `/api/log` endpoint that accepts JSON lines and forwards to Loki — gated by build flavor.

---

## 15. File layout

After full rollout (mirrors `gathering`):

```
docker/observability/
├── docker-compose.yml                   # Prometheus, postgres-exporter, Loki,
│                                          Promtail, Grafana, Tempo, OTel Collector
├── prometheus/prometheus.yml
├── loki/loki-config.yml
├── promtail/promtail-config.yml         # Docker SD + JSON pipeline
├── otel-collector/config.yml            # OTLP → Tempo + spanmetrics
├── tempo/tempo-config.yml
└── grafana/
    ├── provisioning/
    │   ├── datasources/datasources.yml  # Prom, Loki, Tempo + correlation
    │   └── dashboards/dashboards.yml
    └── dashboards/
        ├── overview.json
        ├── edge-functions.json
        ├── postgres-health.json
        ├── logs-explorer.json
        ├── cron-jobs.json
        ├── traces.json
        └── realtime-cost-guard.json     # TTPortal-specific

grafana-cloud/
├── alerts/
│   ├── edge-functions.json
│   ├── postgres.json
│   ├── cron-jobs.json
│   ├── push-pipeline.json
│   └── egress-realtime.json             # TTPortal-specific
└── dashboards/                          # Cloud-remapped versions of local

sentry/
└── alerts/
    └── issue-alerts.json

supabase/functions/_shared/
├── logger.ts                            # createLogger + withTiming
├── otel.ts                              # Hand-rolled OTLP/HTTP
└── sentry.ts                            # Optional: thin Edge-side Sentry posting

scripts/
├── start-observability.sh
├── stop-observability.sh
├── check-supabase-usage.ts              # Egress monitor (GH Actions)
├── sync-grafana-dashboards.sh           # CI sync from grafana-cloud/dashboards
├── sync-grafana-alerts.sh
└── sync-sentry-alerts.sh

.github/workflows/
└── egress-check.yml

docs/
├── observability-local.md               # Quickstart for new devs
├── observability-cloud.md               # Production setup, credentials
└── runbooks/
    ├── edge-5xx-spike.md
    ├── postgres-cache-hit-low.md
    ├── cron-missed.md
    ├── push-failure-spike.md
    └── egress-spike.md
```

Database additions:
- `cron_run_log` table
- `push_metrics` table
- `slow_query_log` table
- `run_*()` wrapper functions for each cron job
- `pg_stat_statements` extension enabled

---

## Appendix A: Sample queries

### LogQL (Loki)

```logql
# All edge function requests last 5 min
{job="supabase_edge_functions", type="request"}

# Errors only, grouped by function
sum by (function) (
  count_over_time({job="supabase_edge_functions", level="error"}[5m])
)

# p95 latency from access logs (no spans needed)
quantile_over_time(0.95,
  {job="supabase_edge_functions", type="request"} | json | unwrap duration_ms [5m])
by (function)

# Find logs for a specific trace
{job="supabase_edge_functions"} |= "3465915c6a467d6e7c1e58c6f9bd44e2"

# Rate-limit denials per route
sum by (function) (count_over_time(
  {job="supabase_edge_functions", level="warn"} |= "rate_limit_exceeded"[5m]))
```

### PromQL

```promql
# Request rate by route
sum by (http_route) (rate(otelcol_edge_functions_calls_total[1m]))

# Error rate (5xx) by route
sum by (http_route) (
  rate(otelcol_edge_functions_calls_total{http_response_status_code=~"5.."}[5m]))

# p95 latency from histogram
histogram_quantile(0.95,
  sum by (http_route, le) (rate(otelcol_edge_functions_duration_milliseconds_bucket[5m])))

# Postgres connections by state
sum by (state) (pg_stat_activity_count)

# Cache hit ratio
pg_stat_database_blks_hit_total
/ (pg_stat_database_blks_hit_total + pg_stat_database_blks_read_total)

# Deadlock rate
rate(pg_stat_database_deadlocks_total[5m])
```

### TraceQL (Tempo)

```traceql
# All spans
{ }

# Slow spans (>200ms)
{ duration > 200ms }

# Errors
{ status = error }

# A specific Edge Function
{ resource.service.name = "ttportal-edge" && name = "POST send-app-invite" }
```

### SQL (cron / push dashboards)

```sql
-- Last 24h cron summary
select job_name,
       count(*) filter (where status='success') as ok,
       count(*) filter (where status='error') as err,
       max(started_at) as last_run,
       avg(duration_ms) as avg_ms
from cron_run_log
where started_at > now() - interval '24h'
group by job_name;

-- Push success ratio last 1h
select trigger_name,
       count(*) total,
       count(*) filter (where expo_status_code = 200) success,
       round(100.0 * count(*) filter (where expo_status_code = 200) / count(*), 2) success_pct
from push_metrics
where sent_at > now() - interval '1h'
group by trigger_name;
```

---

## Appendix B: Alternative stacks considered

| Stack | Pros | Cons | Verdict |
|---|---|---|---|
| **LGTM (Grafana stack) — chosen** | Industry standard; fully OSS; managed Free tier; mirrors `gathering` exactly | Many components (5+ binaries) | **Use** |
| **SigNoz** | All-in-one OSS APM; ClickHouse-backed (cheap storage); single binary deploy | Younger; weaker RN ecosystem; no managed free tier comparable to Grafana Cloud | Re-evaluate at year 2 if self-hosting |
| **OpenObserve** | ClickHouse-backed; low storage cost; Rust-implemented (efficient) | Newer; smaller community | Watch |
| **HyperDX** | OTel-native; clean UX | Newer; pricing model uncertain | Watch |
| **Elastic / OpenSearch** | Mature, full-text powerful | Heavy ops; expensive at scale | No |
| **Datadog** | Best-in-class UX | $$$, not OSS, vendor lock | No |
| **Honeycomb** | Excellent for traces | Free tier limited; not OSS | No |
| **VictoriaMetrics + VictoriaLogs** | Prom-compatible; very low memory | Less mature logs side; smaller community | Consider as Prom replacement if cardinality bills bite |
| **Grafana Alloy** (replaces Promtail + OTel Collector) | One binary; fewer moving parts | Newer; reference configs in `gathering` use the older pieces | Migrate after v0.1 |

---

## Approval & sign-off

- [ ] **Plan reviewed** by tavig
- [ ] **Phase 0 budget** approved ($5/mo Kuma VPS)
- [ ] **Sentry org** access granted
- [ ] **Grafana Cloud account** created
- [ ] **Supabase Pro upgrade** decision made (affects Phase 3 prod path)
- [ ] **Slack channel `#alerts`** created and webhook generated

Once these are checked, kick off Phase 0.
