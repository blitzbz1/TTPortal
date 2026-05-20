# Observability — Grafana Cloud production setup

What the local stack does for dev, Grafana Cloud does for production. This guide walks the one-time setup. Budget: $0/mo on Free tier at current scale.

## What you'll have at the end

- Edge Function logs in Loki, traces in Tempo, RED metrics derived in Cloud-side spanmetrics.
- Three dashboards: Edge Functions Overview, Logs Explorer, Traces.
- Four synthetic uptime checks (healthz, REST, auth, web) at 1–5 min intervals.
- Six alerts firing into Discord (5xx errors, p95 high latency, p95 per-function regression, observability pipeline failure, synthetic check failed, synthetic slow).

## 1. Create Grafana Cloud stack

1. Sign up at <https://grafana.com/auth/sign-up/create-user>.
2. Create a stack (any name — ours is **`ttportalinfo`**, giving `ttportalinfo.grafana.net`). The stack name does **not** need to match the dashboards: Grafana Cloud datasource **UIDs** are the short form `grafanacloud-prom` / `grafanacloud-logs` / `grafanacloud-traces` regardless of stack name. The longer `grafanacloud-<stack>-prom` string is the datasource *display name*, not its UID — don't put it in dashboard/alert JSON. The files in `grafana-cloud/` reference the short-form UIDs, so they import into any stack with no datasource remapping.

## 2. Mint an access token for Edge Function push

1. **Connections → Access Policies → Create access policy**. Name: `observability-write`.
2. Scopes: `metrics:write`, `logs:write`, `traces:write` — **all three**. If you instead let the *OpenTelemetry onboarding wizard* mint a token, it may be scoped to `traces:write` only; Loki then 401s with `invalid token`. Add `logs:write` to that policy (or reuse this `observability-write` token for Loki).
3. **Add token** → copy it once (it won't be shown again).
4. From **Connections → Loki**, copy your **Loki URL** (e.g., `https://logs-prod-eu-west-2.grafana.net`) and **User ID**.
5. From **Connections → OpenTelemetry**, copy the **OTLP endpoint** (e.g., `https://otlp-gateway-prod-eu-west-2.grafana.net/otlp`) and the **Instance ID**. Build the auth header as `Basic base64(<instanceId>:<token>)`.

## 3. Set Edge Function secrets

```bash
npx supabase secrets set \
  OTEL_EXPORTER_OTLP_ENDPOINT="https://otlp-gateway-prod-<region>.grafana.net/otlp" \
  OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic%20<base64(instanceId:token)>" \
  GRAFANA_CLOUD_LOKI_URL="https://logs-prod-<region>.grafana.net" \
  GRAFANA_CLOUD_LOKI_USER="<loki_user_id>" \
  GRAFANA_CLOUD_LOKI_TOKEN="<token>" \
  ENVIRONMENT="production"
```

Important:

- `OTEL_EXPORTER_OTLP_HEADERS` must be URL-encoded — that's why `%20` (space) appears between `Basic` and the base64 string.
- `GRAFANA_CLOUD_LOKI_TOKEN` is the **raw** `glc_…` token only — no `Basic`, no base64, no `%20`. The logger builds the `Basic base64(user:token)` header itself, so don't pre-format it like the OTLP one.
- `GRAFANA_CLOUD_LOKI_USER` is the Loki datasource's **Basic Auth User** (a number, e.g. `1586689`) — a different value from the OTLP **Instance ID**. Find it under Connections → Data sources → the Loki datasource.
- Paste the token and anon key straight from source into the terminal. Copying via a notes/chat app can inject smart quotes (`”`) or spaces, which break the Loki push with `Cannot encode string … outside of the Latin1 range` (smart quote) or `401 invalid token` (stray space).
- Secrets bind at deploy time — re-run `supabase functions deploy` after changing any secret.

## 4. Deploy

```bash
npx supabase functions deploy healthz
npx supabase functions deploy send-app-invite
npx supabase functions deploy amatur-proxy
npx supabase functions deploy send-password-changed-email
```

The healthz function is deployed with `verify_jwt = false` (configured in `supabase/config.toml`) so synthetic checks can hit it unauthenticated.

## 5. Verify telemetry flow

```bash
PROJECT_REF=<your-project-ref>
curl -i "https://${PROJECT_REF}.supabase.co/functions/v1/healthz"
```

Within ~10s in Grafana Cloud:

- **Explore → Loki** → query `{job="supabase_edge_functions", function="healthz"}` — should show one structured request log.
- **Explore → Tempo** → search by service name `healthz` (may take ~30s the first time) — should show one span.

If logs are missing, check the Edge Function logs in the Supabase dashboard at `https://supabase.com/dashboard/project/<ref>/functions/healthz/logs` (the `supabase functions logs` CLI subcommand has been removed) and look for `[loki] push non-2xx`. If spans are missing, look for `[otel] OTLP export failed`.

## 6. Import dashboards

In Grafana Cloud → **Dashboards → New → Import → Upload JSON file**, import each:

- `grafana-cloud/dashboards/edge-functions.json` → "TTPortal — Edge Functions Overview"
- `grafana-cloud/dashboards/logs-explorer.json` → "TTPortal — Logs Explorer"
- `grafana-cloud/dashboards/traces.json` → "TTPortal — Traces"

These reference the short-form datasource UIDs (`grafanacloud-logs` / `grafanacloud-prom` / `grafanacloud-traces`), so they import with no datasource remapping. Save.

> Not included: `postgres-health` needs the Supabase Metrics Endpoint (Pro plan) and `cron-jobs` needs the `cron_run_log` table (Phase 5). Both would render empty until those exist, so they're deferred — see `monitoring.md`.

## 7. Configure synthetic uptime checks

**Grafana Cloud → Synthetic Monitoring → Add new check**, once per row below. Use the **API Endpoint** check type (HTTP). The **Job name** must start with `ttportalinfo-` — the synthetics alerts query `probe_success{job=~"ttportalinfo-.*"}`, so a `ttportal-*` name will never match them.

| Job name | Target | Notes | Frequency |
|---|---|---|---|
| `ttportalinfo-healthz` | `https://<ref>.supabase.co/functions/v1/healthz` | none (deployed with `verify_jwt = false`) | 1 min |
| `ttportalinfo-web` | (your web app URL) | none | 5 min |
| `ttportalinfo-auth` | `https://<ref>.supabase.co/auth/v1/health?apikey=<anon-key>` | 401s without the key | 5 min |
| `ttportalinfo-rest` | `https://<ref>.supabase.co/rest/v1/events?select=id&limit=1&apikey=<anon-key>` | the REST **root** `/rest/v1/` is service_role-only (401) — hit a real table instead | 5 min |

`<anon-key>` is the public `EXPO_PUBLIC_SUPABASE_ANON_KEY` (from `.env`) — safe in a probe URL. It can also be passed as an `apikey` request header instead of a query param.

For each check: probe location = closest region. Expect 200. Save. Synthetic Monitoring writes `probe_success{job="ttportalinfo-*"}` and `probe_duration_seconds{job="ttportalinfo-*"}` into Prometheus, which the Synthetics alerts consume.

> If you edit a check's target later, its `instance` label changes and the old series lingers ~5 min in Prometheus. Wait for `min(probe_success{job=~"ttportalinfo-.*"})` to read `1` before importing the synthetics alerts, or the old failing series can trip the (`noDataState: Alerting`) "check failed" rule.

Free tier covers ~3 checks at 1-min frequency or many more at 5-min frequency. The healthz canary at 1 min plus three 5-min checks fits comfortably.

## 8. Discord contact point

1. In Discord: **Server Settings → Integrations → Webhooks → New Webhook**. Pick a channel (e.g., `#ttportal-alerts`). Copy the **Webhook URL**.
2. In Grafana Cloud: **Alerting → Contact points → Add contact point**. Name: `discord-alerts`. Integration: **Discord**. Paste the webhook URL. Test → you should see a test message land in Discord.
3. **Alerting → Notification policies → Edit default policy** → set **Default contact point** to `discord-alerts`. Save.

Optional: add a child policy that routes `severity = critical` to `@here` mentions, leaving warnings as plain messages — Grafana Discord integration supports a `Title` / `Message` template you can customize.

## 9. Import alerts

First create the folder, then push the rule groups. The folder UID **must** match the `folderUID` in the JSON files (`ttportalinfo-alerts`):

```bash
GRAFANA_URL="https://<your-stack>.grafana.net"
GRAFANA_TOKEN="<service-account token>"

# 1. Create the alerts folder
curl -s -X POST "$GRAFANA_URL/api/folders" \
  -H "Authorization: Bearer $GRAFANA_TOKEN" -H "Content-Type: application/json" \
  -d '{"uid":"ttportalinfo-alerts","title":"TTPortal Alerts"}'

# 2. Push each file as a Ruler rule group (one group per file)
ruler='{ name: (.[0].ruleGroup), interval: "1m", rules: [ .[] | {
  grafana_alert: { title, condition, data, no_data_state: .noDataState, exec_err_state: .execErrState },
  for, labels, annotations } ] }'
for f in grafana-cloud/alerts/edge-functions.json grafana-cloud/alerts/synthetics.json; do
  curl -s -X POST "$GRAFANA_URL/api/ruler/grafana/api/v1/rules/ttportalinfo-alerts" \
    -H "Authorization: Bearer $GRAFANA_TOKEN" -H "Content-Type: application/json" \
    -d "$(jq "$ruler" "$f")"
done
```

Use the **Ruler** API (`/api/ruler/...`), not the provisioning API (`/api/v1/provisioning/alert-rules`): the provisioning endpoint needs `alert.provisioning:write`, which an **Editor**-role service account lacks (it returns a permissions error). The Ruler API works with `alert.rules:create` (Editor has it) and produces normal, UI-editable rules. Give the service account at least Editor on the `ttportalinfo-alerts` folder.

**The reduce step is mandatory.** Each rule's `data` array is a 3-node chain: `A` (the LogQL/PromQL query) → `B` (a `reduce` / `last` expression) → `C` (the `threshold`), with `condition: "C"`. Never wire a query straight into a threshold — any query returning multiple series or a range then fails evaluation with *"frame cannot uniquely be identified by its labels: duplicate results with labels {}"*. The committed JSON files already include the reduce node; preserve it if you add rules.

To paste a rule in the UI instead (**Alert rules → New rule**), add the Reduce step manually too. Six alerts total.

## 10. Test alert firing

Force a 5xx in `send-app-invite` (e.g., temporarily delete the `SUPABASE_SERVICE_ROLE_KEY` secret, hit the function once). The **TTPortal — Edge Function 5xx errors** alert should fire in Discord within ~5 min. Restore the secret to clear the alert.

For uptime: pause the `ttportalinfo-healthz` synthetic check for 5 minutes. The **Synthetic check failed** alert fires; resume to clear.

## Cost ceiling

Free tier limits at the time of this doc: 50 GB logs/mo, 50 GB traces/mo, 10k metric series, 14-day retention, 3 active 1-min synthetic checks (or many more at lower frequency). At TTPortal's current scale (3–4 active users, ~hundreds of Edge Function calls/day), expected usage is <1% of any limit.

If you ever cross 80% of any limit, Grafana Cloud emails you. Check the **Connections → Billing & Usage** page for current numbers.

## Maintenance

- **Quarterly:** review alert noise. If a warning has fired 50× and never been actionable, raise the threshold or delete it.
- **After every deploy that changes Edge Functions:** verify the **Observability pipeline failure** alert is silent (push hasn't broken).
- **When adding a new Edge Function:** wrap it in `withTiming('<name>', handler)`. No other changes needed — it shows up in the dashboard automatically.

## Roadmap (deferred from v1)

- Postgres metrics (Supabase Metrics Endpoint, requires Pro plan).
- Sentry for client-side React Native + web errors.
- Cron job health tracking + push pipeline metrics.
- Egress / cost early warning (GitHub Actions cron against Supabase usage API).

See `monitoring.md` for the full multi-phase roadmap.
