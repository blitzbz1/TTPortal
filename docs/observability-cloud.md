# Observability — Grafana Cloud production setup

What the local stack does for dev, Grafana Cloud does for production. This guide walks the one-time setup. Budget: $0/mo on Free tier at current scale.

## What you'll have at the end

- Edge Function logs in Loki, traces in Tempo, RED metrics derived in Cloud-side spanmetrics.
- Three dashboards: Edge Functions Overview, Logs Explorer, Traces.
- Four synthetic uptime checks (healthz, REST, auth, web) at 1–5 min intervals.
- Six alerts firing into Discord (5xx errors, p95 high latency, p95 per-function regression, observability pipeline failure, synthetic check failed, synthetic slow).

## 1. Create Grafana Cloud stack

1. Sign up at <https://grafana.com/auth/sign-up/create-user>.
2. Create a stack named **`ttportal`** (the dashboard JSON files use `grafanacloud-ttportal-logs` / `grafanacloud-ttportal-prom` as datasource UIDs — naming the stack `ttportal` makes them resolve out of the box). If you pick a different name, the importer will prompt you to map datasources manually; not fatal, just a one-time click.

## 2. Mint an access token for Edge Function push

1. **Connections → Access Policies → Create access policy**. Name: `observability-write`.
2. Scopes: `metrics:write`, `logs:write`, `traces:write`.
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

Important: the `Authorization` header value must be URL-encoded — that's why `%20` (space) appears between `Basic` and the base64 string.

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

If logs are missing, check `npx supabase functions logs healthz` for `[loki] push non-2xx`. If spans are missing, look for `[otel] OTLP export failed`. Both error patterns are also caught by the **Observability pipeline failure** alert below.

## 6. Import dashboards

In Grafana Cloud → **Dashboards → New → Import → Upload JSON file**, import each:

- `grafana-cloud/dashboards/edge-functions.json` → "TTPortal — Edge Functions Overview"
- `grafana-cloud/dashboards/logs-explorer.json` → "TTPortal — Logs Explorer"

If your stack isn't named `ttportal`, the importer prompts you to map `grafanacloud-ttportal-logs` / `grafanacloud-ttportal-prom` to your actual datasources. Save.

## 7. Configure synthetic uptime checks

**Grafana Cloud → Synthetic Monitoring → Add new check**. Repeat for each:

| Check name | Type | Target | Frequency |
|---|---|---|---|
| `ttportal-healthz` | HTTP | `https://<ref>.supabase.co/functions/v1/healthz` | 1 min |
| `ttportal-rest` | HTTP | `https://<ref>.supabase.co/rest/v1/?apikey=<anon-key>` | 5 min |
| `ttportal-auth` | HTTP | `https://<ref>.supabase.co/auth/v1/health` | 5 min |
| `ttportal-web` | HTTP | (your web app URL) | 5 min |

For each check: probe location = closest region. Expect 200. Save. Synthetic Monitoring writes `probe_success{job="ttportal-*"}` and `probe_duration_seconds{job="ttportal-*"}` into your Prometheus, which the Synthetics alerts consume.

Free tier covers ~3 checks at 1-min frequency or many more at 5-min frequency. The healthz canary at 1 min plus three 5-min checks fits comfortably.

## 8. Discord contact point

1. In Discord: **Server Settings → Integrations → Webhooks → New Webhook**. Pick a channel (e.g., `#ttportal-alerts`). Copy the **Webhook URL**.
2. In Grafana Cloud: **Alerting → Contact points → Add contact point**. Name: `discord-alerts`. Integration: **Discord**. Paste the webhook URL. Test → you should see a test message land in Discord.
3. **Alerting → Notification policies → Edit default policy** → set **Default contact point** to `discord-alerts`. Save.

Optional: add a child policy that routes `severity = critical` to `@here` mentions, leaving warnings as plain messages — Grafana Discord integration supports a `Title` / `Message` template you can customize.

## 9. Import alerts

Grafana Cloud's Alerting UI accepts JSON via API. Easiest path:

1. **Alerting → Alert rules → New folder**. Name: `ttportal-alerts`. Note the folder UID — if it's not literally `ttportal-alerts`, edit the `folderUID` field in the JSON files before import.
2. Provision via the Grafana HTTP API (or the Cloud Stack provisioning UI):

   ```bash
   GRAFANA_URL="https://<your-stack>.grafana.net"
   GRAFANA_TOKEN="<service account token with alerting:write>"

   # Edge Function alerts
   for rule in $(jq -c '.[]' grafana-cloud/alerts/edge-functions.json); do
     curl -X POST "$GRAFANA_URL/api/v1/provisioning/alert-rules" \
       -H "Authorization: Bearer $GRAFANA_TOKEN" \
       -H "Content-Type: application/json" \
       -d "$rule"
   done

   # Synthetics alerts
   for rule in $(jq -c '.[]' grafana-cloud/alerts/synthetics.json); do
     curl -X POST "$GRAFANA_URL/api/v1/provisioning/alert-rules" \
       -H "Authorization: Bearer $GRAFANA_TOKEN" \
       -H "Content-Type: application/json" \
       -d "$rule"
   done
   ```

   Or paste each rule into the Grafana UI (**Alert rules → New rule**, copy fields from JSON). Six alerts total.

## 10. Test alert firing

Force a 5xx in `send-app-invite` (e.g., temporarily delete the `SUPABASE_SERVICE_ROLE_KEY` secret, hit the function once). The **TTPortal — Edge Function 5xx errors** alert should fire in Discord within ~5 min. Restore the secret to clear the alert.

For uptime: pause the `ttportal-healthz` synthetic check for 5 minutes. The **Synthetic check failed** alert fires; resume to clear.

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
