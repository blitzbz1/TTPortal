// Static import of the hand-rolled OTLP exporter. Top-level so any module
// resolution failure surfaces clearly at function load instead of being
// silently swallowed at runtime.
import { startSpan, SpanKind, SpanStatus, flushNow, type Span } from './otel.ts';

// Supabase Edge Runtime exposes `EdgeRuntime.waitUntil` to keep the worker
// alive past the response; fall back to awaiting the export otherwise.
declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined;

// =============================================================================
// Grafana Cloud Loki push (best-effort, fire-and-forget)
// =============================================================================
// Reads credentials from env vars. When unset (local dev), Loki push is skipped
// and logs go only to stdout (where local Promtail picks them up).

const lokiUrl = Deno.env.get('GRAFANA_CLOUD_LOKI_URL');
const lokiUser = Deno.env.get('GRAFANA_CLOUD_LOKI_USER');
const lokiToken = Deno.env.get('GRAFANA_CLOUD_LOKI_TOKEN');
const lokiEnabled = !!(lokiUrl && lokiUser && lokiToken);

interface LokiEntry {
  ts: string; // nanosecond unix timestamp as string
  line: string;
  labels: Record<string, string>;
}

let lokiBuffer: LokiEntry[] = [];

function bufferForLoki(entry: LogEntry): void {
  if (!lokiEnabled) return;
  lokiBuffer.push({
    ts: (BigInt(Date.now()) * 1000000n).toString(),
    line: JSON.stringify(entry),
    labels: {
      job: 'supabase_edge_functions',
      function: entry.function,
      level: entry.level,
      ...(entry.data?.type ? { type: String(entry.data.type) } : {}),
    },
  });
}

async function flushLoki(): Promise<void> {
  if (!lokiEnabled || lokiBuffer.length === 0) return;
  const entries = lokiBuffer;
  lokiBuffer = [];

  // Group entries by label set
  const streamMap = new Map<string, { stream: Record<string, string>; values: string[][] }>();
  for (const e of entries) {
    const key = JSON.stringify(e.labels);
    let stream = streamMap.get(key);
    if (!stream) {
      stream = { stream: e.labels, values: [] };
      streamMap.set(key, stream);
    }
    stream.values.push([e.ts, e.line]);
  }

  const payload = { streams: Array.from(streamMap.values()) };
  try {
    const res = await fetch(`${lokiUrl}/loki/api/v1/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${lokiUser}:${lokiToken}`)}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[loki] push non-2xx: ${res.status} ${body.slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`[loki] push failed: ${(err as Error).message}`);
  }
}

async function shipTelemetry(): Promise<void> {
  const p = Promise.all([flushNow(), flushLoki()]);
  const rt = typeof EdgeRuntime !== 'undefined' ? EdgeRuntime : undefined;
  if (rt?.waitUntil) {
    rt.waitUntil(p);
    return;
  }
  await p;
}

interface RequestContext {
  routeName: string;
  method: string;
  path: string;
  requestId: string | null;
  timer: { elapsed: () => number };
  span: Span;
  accessLogger: Logger;
}

// Request-scoped trace ID. Edge Runtime processes one request per isolate,
// so a module-level variable is safe. withTiming sets this before invoking
// the handler and clears it after. The log() function reads it automatically
// so every log line emitted during a request carries the trace_id.
let activeTraceId: string | null = null;

// Request-scoped root span context. Set by withTiming so handlers can create
// child spans via withSpan() without threading the root span through every
// function signature.
let activeRootContext: { traceId: string; spanId: string } | null = null;

/**
 * Returns the current request's root span context, or null when called
 * outside a withTiming-wrapped handler. Use this if you need to create
 * spans manually; prefer `withSpan()` for the common case.
 */
export function getActiveTraceContext(): { traceId: string; spanId: string } | null {
  return activeRootContext;
}

/**
 * Wraps an async operation in a child span of the current request's root
 * span. No-ops (just runs `fn`) when called outside a withTiming context.
 *
 * The span is ended OK on success and ERROR on throw; the original error is
 * always re-thrown so existing error handling is unchanged.
 */
export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean> | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const root = activeRootContext;
  if (!root) return fn();
  const child = startSpan({
    serviceName: name.split('.')[0] ?? name,
    name,
    kind: SpanKind.INTERNAL,
    attributes: attributes ?? {},
    traceId: root.traceId,
    parentSpanId: root.spanId,
  });
  try {
    const result = await fn();
    child.end({ statusCode: SpanStatus.OK });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    child.setAttribute('exception.message', message);
    child.end({ statusCode: SpanStatus.ERROR, statusMessage: message });
    throw err;
  }
}

function recordRequestSuccess(ctx: RequestContext, status: number): void {
  ctx.span.setAttribute('http.response.status_code', status);
  ctx.span.end({
    statusCode: status >= 500 ? SpanStatus.ERROR : SpanStatus.OK,
  });
  const data: Record<string, unknown> = {
    type: 'request',
    route: ctx.routeName,
    method: ctx.method,
    path: ctx.path,
    status,
    duration_ms: ctx.timer.elapsed(),
    trace_id: ctx.span.traceId,
  };
  if (status >= 500) {
    ctx.accessLogger.error('request error', ctx.requestId, undefined, data);
  } else if (status >= 400) {
    ctx.accessLogger.warn('request client error', ctx.requestId, data);
  } else {
    ctx.accessLogger.info('request completed', ctx.requestId, data);
  }
}

function recordRequestFailure(ctx: RequestContext, error: Error): void {
  ctx.span.setAttribute('http.response.status_code', 500);
  ctx.span.setAttribute('exception.message', error.message);
  ctx.span.end({ statusCode: SpanStatus.ERROR, statusMessage: error.message });
  ctx.accessLogger.error('request failed', ctx.requestId, error, {
    type: 'request',
    route: ctx.routeName,
    method: ctx.method,
    path: ctx.path,
    status: 500,
    duration_ms: ctx.timer.elapsed(),
    trace_id: ctx.span.traceId,
  });
}

function pathOf(req: Request): string {
  try {
    return new URL(req.url).pathname;
  } catch {
    return req.url;
  }
}

// W3C Trace Context: `00-<32-hex traceId>-<16-hex spanId>-<2-hex flags>`.
// Returns null on any malformed input so withTiming silently falls back to a
// fresh root span — never reject a request because the header is bad.
const TRACEPARENT_RE = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;

function parseTraceparent(header: string | null): { traceId: string; parentSpanId: string } | null {
  if (!header) return null;
  const m = TRACEPARENT_RE.exec(header.trim());
  if (!m) return null;
  // Reject the all-zero IDs the spec calls out as invalid.
  if (/^0+$/.test(m[2]) || /^0+$/.test(m[3])) return null;
  return { traceId: m[2].toLowerCase(), parentSpanId: m[3].toLowerCase() };
}

/**
 * Structured JSON logging utility for Supabase Edge Functions.
 *
 * Provides consistent, structured logging with JSON output for easy parsing
 * in the Supabase dashboard. Supports request ID tracking for correlation
 * across distributed function calls.
 *
 * @module supabase/functions/_shared/logger
 *
 * @example
 * ```typescript
 * import { createLogger } from '../_shared/logger.ts';
 *
 * const logger = createLogger('send-app-invite');
 * logger.info('Processing invite', requestId, { email_domain: 'example.com' });
 * logger.error('Operation failed', requestId, new Error('timeout'), { attempt: 3 });
 * ```
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Log level for structured logging.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log entry format for JSON output.
 */
export interface LogEntry {
  /** ISO 8601 timestamp of the log entry */
  timestamp: string;
  /** Log severity level */
  level: LogLevel;
  /** Function name that generated the log */
  function: string;
  /** Optional request ID for correlation */
  requestId: string | null;
  /** Human-readable log message */
  message: string;
  /** Trace ID for log-to-trace correlation (set automatically by withTiming) */
  trace_id?: string;
  /** Optional structured data payload */
  data?: Record<string, unknown>;
  /** Optional error details */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Options for creating a log entry.
 */
export interface LogOptions {
  /** Log severity level */
  level: LogLevel;
  /** Human-readable log message */
  message: string;
  /** Optional request ID for correlation */
  requestId: string | null;
  /** Optional structured data payload */
  data?: Record<string, unknown>;
  /** Optional error object */
  error?: Error;
}

/**
 * Logger instance with convenience methods for each log level.
 */
export interface Logger {
  debug: (message: string, requestId: string | null, data?: Record<string, unknown>) => void;
  info: (message: string, requestId: string | null, data?: Record<string, unknown>) => void;
  warn: (message: string, requestId: string | null, data?: Record<string, unknown>) => void;
  error: (
    message: string,
    requestId: string | null,
    error?: Error,
    data?: Record<string, unknown>
  ) => void;
}

// =============================================================================
// Implementation
// =============================================================================

function log(functionName: string, options: LogOptions): void {
  const { level, message, requestId, data, error } = options;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    function: functionName,
    requestId,
    message,
    ...(activeTraceId ? { trace_id: activeTraceId } : {}),
  };

  if (data && Object.keys(data).length > 0) {
    entry.data = data;
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }

  const output = JSON.stringify(entry);

  switch (level) {
    case 'debug':
    case 'info':
      console.log(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'error':
      console.error(output);
      break;
  }

  bufferForLoki(entry);
}

/**
 * Creates a logger instance for a specific Edge Function.
 */
export function createLogger(functionName: string): Logger {
  return {
    debug: (message, requestId, data): void => {
      log(functionName, { level: 'debug', message, requestId, data });
    },
    info: (message, requestId, data): void => {
      log(functionName, { level: 'info', message, requestId, data });
    },
    warn: (message, requestId, data): void => {
      log(functionName, { level: 'warn', message, requestId, data });
    },
    error: (message, requestId, error, data): void => {
      log(functionName, { level: 'error', message, requestId, data, error });
    },
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Extracts the request ID from the x-request-id header, or null if absent.
 */
export function getRequestId(req: Request): string | null {
  return req.headers.get('x-request-id');
}

/**
 * Creates a duration tracker for measuring request processing time.
 */
export function createTimer(): { startTime: number; elapsed: () => number } {
  const startTime = Date.now();
  return {
    startTime,
    elapsed: (): number => Date.now() - startTime,
  };
}

/**
 * Wraps an Edge Function handler with request timing and structured access logging.
 *
 * Emits exactly one structured log line per request with `type: "request"` so
 * Promtail/Loki can filter access logs cleanly from app logs. Captures route,
 * method, status, duration_ms, request_id, and (on failure) the error.
 *
 * Re-throws after logging so existing error handling in the function is
 * unchanged. If the handler throws, status is recorded as 500.
 *
 * @example
 * ```typescript
 * serve(withTiming('send-app-invite', async (req) => {
 *   // ... handler ...
 *   return new Response(...);
 * }));
 * ```
 */
export function withTiming(
  routeName: string,
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  const accessLogger = createLogger(routeName);
  return async (req: Request): Promise<Response> => {
    const requestId = getRequestId(req);
    const method = req.method;
    const path = pathOf(req);
    const parentCtx = parseTraceparent(req.headers.get('traceparent'));
    const span = startSpan({
      serviceName: routeName,
      name: `${method} ${routeName}`,
      kind: SpanKind.SERVER,
      attributes: {
        'http.request.method': method,
        'http.route': routeName,
        'url.path': path,
        ...(requestId ? { 'http.request.id': requestId } : {}),
      },
      ...(parentCtx ? { traceId: parentCtx.traceId, parentSpanId: parentCtx.parentSpanId } : {}),
    });
    const ctx: RequestContext = {
      routeName,
      method,
      path,
      requestId,
      timer: createTimer(),
      span,
      accessLogger,
    };

    activeTraceId = span.traceId;
    activeRootContext = { traceId: span.traceId, spanId: span.spanId };
    try {
      const response = await handler(req);
      recordRequestSuccess(ctx, response.status);
      await shipTelemetry();
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      recordRequestFailure(ctx, error);
      await shipTelemetry();
      throw error;
    } finally {
      activeTraceId = null;
      activeRootContext = null;
    }
  };
}

/**
 * Truncates a sensitive string for safe logging (token prefix + ellipsis).
 */
export function truncateForLog(value: string, length = 20): string {
  if (value.length <= length) {
    return value;
  }
  return value.slice(0, length) + '...';
}
