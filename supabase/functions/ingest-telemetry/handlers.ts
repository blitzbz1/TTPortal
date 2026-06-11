// Pure request-shaping helpers for ingest-telemetry — separated from
// index.ts so they can be unit-tested without starting Deno.serve.

export const MAX_EVENTS_PER_CALL = 50;
const MAX_LINE_BYTES = 8 * 1024;

export interface TelemetryEvent {
  kind: 'crash' | 'event';
  name: string;
  level?: 'error' | 'fatal' | 'info';
  ts?: number; // client epoch ms; clamped server-side
  platform?: string;
  appVersion?: string;
  data?: Record<string, unknown>;
}

/** Validates + normalizes one client event; returns null if malformed. */
export function sanitizeEvent(raw: unknown, nowMs: number): TelemetryEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (e.kind !== 'crash' && e.kind !== 'event') return null;
  if (typeof e.name !== 'string' || !e.name || e.name.length > 128) return null;
  // Clamp client timestamps to [now-24h, now] — buffered offline events keep
  // a meaningful time, garbage timestamps don't pollute retention queries.
  let ts = typeof e.ts === 'number' ? e.ts : nowMs;
  if (!Number.isFinite(ts) || ts > nowMs || ts < nowMs - 24 * 3600 * 1000) ts = nowMs;
  return {
    kind: e.kind,
    name: e.name,
    level: e.level === 'fatal' || e.level === 'error' ? e.level : e.kind === 'crash' ? 'error' : 'info',
    ts,
    platform: typeof e.platform === 'string' ? e.platform.slice(0, 16) : 'unknown',
    appVersion: typeof e.appVersion === 'string' ? e.appVersion.slice(0, 32) : 'unknown',
    data: e.data && typeof e.data === 'object' ? (e.data as Record<string, unknown>) : undefined,
  };
}

export function toLokiStreams(events: TelemetryEvent[]) {
  const streamMap = new Map<string, { stream: Record<string, string>; values: string[][] }>();
  for (const e of events) {
    const labels = {
      job: 'ttportal_app',
      kind: e.kind,
      level: e.level ?? 'info',
      platform: e.platform ?? 'unknown',
    };
    let line = JSON.stringify({ name: e.name, appVersion: e.appVersion, ...e.data });
    if (line.length > MAX_LINE_BYTES) line = line.slice(0, MAX_LINE_BYTES);
    const key = JSON.stringify(labels);
    let stream = streamMap.get(key);
    if (!stream) {
      stream = { stream: labels, values: [] };
      streamMap.set(key, stream);
    }
    stream.values.push([(BigInt(e.ts!) * 1000000n).toString(), line]);
  }
  return Array.from(streamMap.values());
}

