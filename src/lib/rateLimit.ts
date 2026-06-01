// Client-side helper for the server-side rate limiting installed in
// supabase/migrations/047_rate_limits.sql.
//
// The server-side BEFORE-INSERT triggers raise a structured Postgres
// exception when a request is rate limited. PostgREST surfaces that as a
// 4xx with `message` set to the raised string. This module parses those
// messages so callers can show a helpful "try again in N seconds" prompt
// instead of a generic error.
//
// We intentionally do NOT do any client-side counting — the source of
// truth lives in the database. Mirroring counts here would only add
// drift, and any spammer worth their salt would clear AsyncStorage.

export type RateLimitInfo =
  | { kind: 'user'; action: string; windowSecs: number; max: number }
  | { kind: 'ip'; action: string; windowSecs: number; max: number }
  | { kind: 'ip_blocked'; ip: string };

const USER_RE = /rate_limit_exceeded:user:([^:]+):(\d+):(\d+)/;
const IP_RE = /rate_limit_exceeded:ip:([^:]+):(\d+):(\d+)/;
const IP_BLOCKED_RE = /ip_blocked:(.+)/;

// Inspect a Supabase / PostgREST error and return structured rate-limit
// info if it's one of ours, or null otherwise. Accepts the whole error
// object because Supabase puts the trigger message on different fields
// depending on the path (postgrest-js versions differ).
export function parseRateLimitError(err: unknown): RateLimitInfo | null {
  if (!err) return null;
  const message =
    (typeof err === 'object' && err !== null
      ? (err as { message?: string; details?: string; hint?: string }).message ??
        (err as { details?: string }).details ??
        (err as { hint?: string }).hint
      : typeof err === 'string'
        ? err
        : undefined) ?? '';

  let m = message.match(USER_RE);
  if (m) {
    return { kind: 'user', action: m[1], windowSecs: Number(m[2]), max: Number(m[3]) };
  }
  m = message.match(IP_RE);
  if (m) {
    return { kind: 'ip', action: m[1], windowSecs: Number(m[2]), max: Number(m[3]) };
  }
  m = message.match(IP_BLOCKED_RE);
  if (m) {
    return { kind: 'ip_blocked', ip: m[1].trim() };
  }
  return null;
}

// Format the wait time in plain language. We use the configured window as
// the worst-case wait (the actual wait is shorter — somewhere between 0
// and `windowSecs` depending on when the user's earliest counted attempt
// landed). Showing the full window is conservative and avoids UI flicker
// from rapidly recomputed countdowns.
export function formatRateLimitMessage(
  info: RateLimitInfo,
  s: (key: string) => string,
): string {
  if (info.kind === 'ip_blocked') return s('rateLimitIpBlocked');
  const minutes = Math.max(1, Math.round(info.windowSecs / 60));
  if (info.kind === 'ip') {
    return s('rateLimitIp').replace('{minutes}', String(minutes));
  }
  // Per-user: pick a per-action copy so the user knows what they hit.
  const key =
    info.action === 'add_venue' ? 'rateLimitAddVenue'
    : info.action === 'create_event' ? 'rateLimitCreateEvent'
    : info.action === 'checkin' ? 'rateLimitCheckin'
    : 'rateLimitGeneric';
  return s(key).replace('{minutes}', String(minutes)).replace('{max}', String(info.max));
}

// Convenience: if `err` is a rate-limit error, return the formatted user
// message; otherwise return null so the caller can fall through to the
// generic error path.
export function rateLimitMessageFor(
  err: unknown,
  s: (key: string) => string,
): string | null {
  const info = parseRateLimitError(err);
  return info ? formatRateLimitMessage(info, s) : null;
}
