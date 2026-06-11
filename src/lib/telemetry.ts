// Client telemetry (T080 crash reporting + T081 product analytics).
// Stays on the existing stack: events batch to the `ingest-telemetry` Edge
// Function, which forwards to Grafana Cloud Loki with server-side
// credentials. No third-party SDK, nothing paid.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { createMMKV } from 'react-native-mmkv';
import { logger } from './logger';

const OPT_OUT_KEY = 'analytics-opt-out';
const QUEUE_KEY = 'queue';

// Lazy + SSR-safe: expo-router's static-render pass imports this module in
// Node, where MMKV's web shim throws on access. A memory map stands in
// there (nothing persists server-side, which is correct — no telemetry
// should ever originate from prerendering).
type KVStore = {
  set: (k: string, v: string | boolean) => void;
  getString: (k: string) => string | undefined;
  getBoolean: (k: string) => boolean | undefined;
};
let _store: KVStore | null = null;
function getStore(): KVStore {
  if (_store) return _store;
  const ssr = Platform.OS === 'web' && typeof window === 'undefined';
  if (ssr) {
    const mem = new Map<string, string | boolean>();
    _store = {
      set: (k, v) => void mem.set(k, v),
      getString: (k) => (typeof mem.get(k) === 'string' ? (mem.get(k) as string) : undefined),
      getBoolean: (k) => (typeof mem.get(k) === 'boolean' ? (mem.get(k) as boolean) : undefined),
    };
  } else {
    _store = createMMKV({ id: 'telemetry' });
  }
  return _store;
}

const FLUSH_INTERVAL_MS = 30_000;
const MAX_QUEUE = 100;
const MAX_BATCH = 50;

export interface TelemetryEvent {
  kind: 'crash' | 'event';
  name: string;
  level?: 'error' | 'fatal' | 'info';
  ts: number;
  platform: string;
  appVersion: string;
  data?: Record<string, unknown>;
}

/** GDPR analytics opt-out (T082's Settings toggle reads/writes this).
 *  Crash reports are NOT gated — they carry no behavioral data and are
 *  legitimate-interest diagnostics; the scrubber keeps PII out of them. */
export function setAnalyticsOptOut(optOut: boolean): void {
  getStore().set(OPT_OUT_KEY, optOut);
}

export function isAnalyticsOptedOut(): boolean {
  return getStore().getBoolean(OPT_OUT_KEY) ?? false;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const JWT_RE = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Strips emails/tokens/user-ids from any string about to leave the device. */
export function scrubPII(value: string): string {
  return value
    .replace(JWT_RE, '[token]')
    .replace(EMAIL_RE, '[email]')
    .replace(UUID_RE, '[uuid]');
}

function scrubData(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') out[k] = scrubPII(v).slice(0, 1024);
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = v;
    // objects/arrays are dropped — keep the wire format flat and bounded
  }
  return out;
}

function loadQueue(): TelemetryEvent[] {
  try {
    const raw = getStore().getString(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as TelemetryEvent[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: TelemetryEvent[]): void {
  try {
    getStore().set(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {}
}

function enqueue(event: Omit<TelemetryEvent, 'ts' | 'platform' | 'appVersion'>): void {
  const queue = loadQueue();
  queue.push({
    ...event,
    data: scrubData(event.data),
    ts: Date.now(),
    platform: Platform.OS,
    appVersion: Constants.expoConfig?.version ?? 'unknown',
  });
  saveQueue(queue);
}

let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushing = false;

async function flush(): Promise<void> {
  if (flushing) return;
  const queue = loadQueue();
  if (queue.length === 0) return;
  flushing = true;
  try {
    const batch = queue.slice(0, MAX_BATCH);
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return;
    const res = await fetch(`${url}/functions/v1/ingest-telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ events: batch }),
    });
    if (res.ok || res.status === 400) {
      // 400 = malformed batch; drop it rather than retrying forever.
      saveQueue(loadQueue().slice(batch.length));
    }
  } catch {
    // Offline — the queue persists in MMKV and retries next interval/launch.
  } finally {
    flushing = false;
  }
}

/** Report a crash/fatal error. Never throws. Not gated by the opt-out. */
export function reportCrash(error: unknown, context?: Record<string, unknown>, fatal = false): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    enqueue({
      kind: 'crash',
      name: scrubPII(err.message ?? 'unknown').slice(0, 256),
      level: fatal ? 'fatal' : 'error',
      data: {
        stack: scrubPII(err.stack ?? '').slice(0, 4096),
        ...context,
      },
    });
    if (fatal) void flush(); // best-effort ship before the app dies
  } catch {}
}

/** Product analytics event (T081). Respects the opt-out. */
export function trackEvent(name: string, data?: Record<string, unknown>): void {
  if (isAnalyticsOptedOut()) return;
  try {
    enqueue({ kind: 'event', name, data });
  } catch {}
}

/**
 * Installs the global crash handlers + the periodic flusher. Call once
 * from the root layout. Dev builds keep the red box and skip remote
 * reporting noise.
 */
export function installCrashReporting(): void {
  if (__DEV__) return;
  if (Platform.OS === 'web' && typeof window === 'undefined') return; // SSR prerender
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (e) => reportCrash(e.error ?? e.message, { source: 'window.onerror' }, true));
      window.addEventListener('unhandledrejection', (e) =>
        reportCrash(e.reason, { source: 'unhandledrejection' }),
      );
    }
  } else {
    const ErrorUtils = (globalThis as any).ErrorUtils;
    if (ErrorUtils?.setGlobalHandler) {
      const previous = ErrorUtils.getGlobalHandler?.();
      ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
        reportCrash(error, { source: 'global' }, !!isFatal);
        previous?.(error, isFatal);
      });
    }
  }
  if (!flushTimer) {
    flushTimer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  }
  // Retention cohort marker (T081): once per cold launch, opt-out-gated.
  trackEvent('session_start');
  void flush(); // ship anything queued from the previous session (incl. fatals)
  logger.info('crash reporting installed');
}

/** Test seam. */
export const __internal = { flush, loadQueue, saveQueue };
