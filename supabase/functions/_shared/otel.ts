/**
 * Minimal OTLP/HTTP trace exporter for Supabase Edge Functions.
 *
 * Hand-rolled rather than using the @opentelemetry/* npm SDKs because the
 * SDK's transitive dependencies don't always resolve cleanly under
 * Supabase's Edge Runtime npm-compat layer, and the SDK silently no-ops
 * on registration failure. This file uses only `fetch`, `crypto`, and
 * standard Web APIs available in Deno.
 *
 * Spans are buffered in memory; call `flushNow()` once per request to ship
 * them. The exporter is best-effort: network failures are logged but never
 * thrown.
 *
 * @module supabase/functions/_shared/otel
 */

const MAX_BUFFER = 256;

// eslint-disable-next-line sonarjs/no-clear-text-protocols
const DEFAULT_OTLP_ENDPOINT = 'http://host.docker.internal:4318';
const endpoint =
  (Deno.env.get('OTEL_EXPORTER_OTLP_ENDPOINT') ?? DEFAULT_OTLP_ENDPOINT).replace(
    /\/$/,
    ''
  ) + '/v1/traces';

const environment = Deno.env.get('ENVIRONMENT') ?? 'local';
const serviceVersion = Deno.env.get('SUPABASE_FUNCTION_VERSION') ?? 'local';

// Parse OTEL_EXPORTER_OTLP_HEADERS (format: "key=value,key2=value2") into
// a plain object for the fetch headers. Required for Grafana Cloud auth.
const extraHeaders: Record<string, string> = {};
const rawHeaders = Deno.env.get('OTEL_EXPORTER_OTLP_HEADERS');
if (rawHeaders) {
  for (const pair of rawHeaders.split(',')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) {
      extraHeaders[decodeURIComponent(pair.slice(0, eqIdx).trim())] =
        decodeURIComponent(pair.slice(eqIdx + 1).trim());
    }
  }
}

interface BufferedSpan {
  serviceName: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Record<string, AttrValue>;
  statusCode: number;
  statusMessage?: string;
}

type AttrValue = string | number | boolean;

let buffer: BufferedSpan[] = [];

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function nowNano(): string {
  return (BigInt(Date.now()) * 1000000n).toString();
}

function toAnyValue(v: AttrValue): Record<string, unknown> {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { boolValue: v };
  if (Number.isInteger(v)) return { intValue: String(v) };
  return { doubleValue: v };
}

function attributesToOtlp(
  attrs: Record<string, AttrValue>
): Array<{ key: string; value: Record<string, unknown> }> {
  return Object.entries(attrs).map(([key, value]) => ({
    key,
    value: toAnyValue(value),
  }));
}

function groupByService(spans: BufferedSpan[]): Map<string, BufferedSpan[]> {
  const byService = new Map<string, BufferedSpan[]>();
  for (const span of spans) {
    const arr = byService.get(span.serviceName) ?? [];
    arr.push(span);
    byService.set(span.serviceName, arr);
  }
  return byService;
}

function spanToOtlp(s: BufferedSpan): Record<string, unknown> {
  return {
    traceId: s.traceId,
    spanId: s.spanId,
    ...(s.parentSpanId ? { parentSpanId: s.parentSpanId } : {}),
    name: s.name,
    kind: s.kind,
    startTimeUnixNano: s.startTimeUnixNano,
    endTimeUnixNano: s.endTimeUnixNano,
    attributes: attributesToOtlp(s.attributes),
    status: {
      code: s.statusCode,
      ...(s.statusMessage ? { message: s.statusMessage } : {}),
    },
  };
}

function buildResourceSpans(
  byService: Map<string, BufferedSpan[]>
): Array<Record<string, unknown>> {
  return Array.from(byService.entries()).map(([serviceName, spans]) => ({
    resource: {
      attributes: attributesToOtlp({
        'service.name': serviceName,
        'service.version': serviceVersion,
        'deployment.environment': environment,
      }),
    },
    scopeSpans: [
      {
        scope: { name: 'ttportal-edge', version: '1.0.0' },
        spans: spans.map(spanToOtlp),
      },
    ],
  }));
}

async function postOtlp(payload: unknown): Promise<void> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(
        `[otel] OTLP export non-2xx: ${res.status} ${res.statusText} ${body.slice(0, 200)}`
      );
    }
  } catch (err) {
    console.error(`[otel] OTLP export failed: ${(err as Error).message}`);
  }
}

async function flush(): Promise<void> {
  if (buffer.length === 0) return;
  const drained = buffer;
  buffer = [];
  const resourceSpans = buildResourceSpans(groupByService(drained));
  await postOtlp({ resourceSpans });
}

export interface Span {
  setAttribute(key: string, value: AttrValue): void;
  end(opts?: { statusCode?: number; statusMessage?: string }): void;
  readonly traceId: string;
  readonly spanId: string;
}

/** OTLP span kind enum: SERVER = 2, CLIENT = 3, INTERNAL = 1. */
export const SpanKind = {
  UNSPECIFIED: 0,
  INTERNAL: 1,
  SERVER: 2,
  CLIENT: 3,
  PRODUCER: 4,
  CONSUMER: 5,
} as const;

/** OTLP status code: UNSET = 0, OK = 1, ERROR = 2. */
export const SpanStatus = {
  UNSET: 0,
  OK: 1,
  ERROR: 2,
} as const;

/**
 * Options for {@link startSpan}. Only `serviceName` and `name` are required.
 */
export interface StartSpanOptions {
  serviceName: string;
  name: string;
  kind?: number;
  attributes?: Record<string, AttrValue>;
  parentSpanId?: string;
  traceId?: string;
}

/**
 * Begin a new span. The returned object must be `end()`-ed exactly once.
 * Spans are appended to a buffer; call `flushNow()` (typically once per
 * request, before responding) to ship them. We don't use a timer because
 * Supabase Edge Runtime tears down isolates between requests.
 */
export function startSpan(opts: StartSpanOptions): Span {
  const {
    serviceName,
    name,
    kind = SpanKind.SERVER,
    attributes = {},
    parentSpanId,
    traceId = randomHex(16),
  } = opts;
  const spanId = randomHex(8);

  const internal: BufferedSpan = {
    serviceName,
    traceId,
    spanId,
    parentSpanId,
    name,
    kind,
    startTimeUnixNano: nowNano(),
    endTimeUnixNano: '',
    attributes: { ...attributes },
    statusCode: SpanStatus.UNSET,
  };

  return {
    traceId,
    spanId,
    setAttribute(key, value) {
      internal.attributes[key] = value;
    },
    end({ statusCode = SpanStatus.UNSET, statusMessage } = {}) {
      internal.endTimeUnixNano = nowNano();
      internal.statusCode = statusCode;
      if (statusMessage) internal.statusMessage = statusMessage;
      if (buffer.length < MAX_BUFFER) buffer.push(internal);
    },
  };
}

/** Force a synchronous flush of any buffered spans. Call before isolate teardown. */
export async function flushNow(): Promise<void> {
  await flush();
}
