// ingest-telemetry (T080/T081): receives crash reports and product events
// from the app and forwards them to Grafana Cloud Loki using the same
// credentials the other Edge Functions already use. The client never holds
// Loki credentials.
//
// verify_jwt = false: crashes from signed-out users matter too. Abuse is
// bounded by strict payload caps and a per-invocation event limit; the
// anon key is still required to reach the function at all.

const lokiUrl = Deno.env.get('GRAFANA_CLOUD_LOKI_URL');
const lokiUser = Deno.env.get('GRAFANA_CLOUD_LOKI_USER');
const lokiToken = Deno.env.get('GRAFANA_CLOUD_LOKI_TOKEN');
const lokiEnabled = !!(lokiUrl && lokiUser && lokiToken);

import { sanitizeEvent, toLokiStreams, MAX_EVENTS_PER_CALL, type TelemetryEvent } from './handlers.ts';

async function pushToLoki(events: TelemetryEvent[]): Promise<void> {
  if (!lokiEnabled || events.length === 0) return;
  const payload = { streams: toLokiStreams(events) };
  const res = await fetch(`${lokiUrl}/loki/api/v1/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${lokiUser}:${lokiToken}`)}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error(`[ingest-telemetry] loki push ${res.status}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }
  const rawEvents = (body as { events?: unknown[] })?.events;
  if (!Array.isArray(rawEvents)) {
    return new Response('events[] required', { status: 400 });
  }
  const now = Date.now();
  const events = rawEvents
    .slice(0, MAX_EVENTS_PER_CALL)
    .map((e) => sanitizeEvent(e, now))
    .filter((e): e is TelemetryEvent => e !== null);

  // Fire-and-forget so the client never waits on Loki.
  const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  const push = pushToLoki(events).catch((err) => console.error('[ingest-telemetry]', err));
  if (rt?.waitUntil) rt.waitUntil(push);
  else await push;

  return new Response(JSON.stringify({ accepted: events.length }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  });
});
