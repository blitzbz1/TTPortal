// Deno tests for the pure helpers (run via `npm run test:functions` after
// extending its path, or directly: deno test --no-check --allow-env supabase/functions/ingest-telemetry/handlers.test.ts).
import { sanitizeEvent, toLokiStreams } from './handlers.ts';

function assertEquals(a: unknown, b: unknown, msg?: string) {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(msg ?? `expected ${sb}, got ${sa}`);
}

const NOW = 1_780_000_000_000;

Deno.test('sanitizeEvent rejects malformed payloads', () => {
  assertEquals(sanitizeEvent(null, NOW), null);
  assertEquals(sanitizeEvent({ kind: 'nope', name: 'x' }, NOW), null);
  assertEquals(sanitizeEvent({ kind: 'event' }, NOW), null);
  assertEquals(sanitizeEvent({ kind: 'event', name: 'x'.repeat(200) }, NOW), null);
});

Deno.test('sanitizeEvent clamps timestamps into [now-24h, now]', () => {
  const future = sanitizeEvent({ kind: 'event', name: 'a', ts: NOW + 99999 }, NOW);
  assertEquals(future?.ts, NOW);
  const ancient = sanitizeEvent({ kind: 'event', name: 'a', ts: 12345 }, NOW);
  assertEquals(ancient?.ts, NOW);
  const recent = sanitizeEvent({ kind: 'event', name: 'a', ts: NOW - 1000 }, NOW);
  assertEquals(recent?.ts, NOW - 1000);
});

Deno.test('sanitizeEvent defaults crash level to error', () => {
  const crash = sanitizeEvent({ kind: 'crash', name: 'boom' }, NOW);
  assertEquals(crash?.level, 'error');
  const fatal = sanitizeEvent({ kind: 'crash', name: 'boom', level: 'fatal' }, NOW);
  assertEquals(fatal?.level, 'fatal');
});

Deno.test('toLokiStreams groups by label set and nanosecond-stamps values', () => {
  const events = [
    sanitizeEvent({ kind: 'event', name: 'a', platform: 'ios', ts: NOW }, NOW)!,
    sanitizeEvent({ kind: 'event', name: 'b', platform: 'ios', ts: NOW }, NOW)!,
    sanitizeEvent({ kind: 'crash', name: 'boom', platform: 'android', ts: NOW }, NOW)!,
  ];
  const streams = toLokiStreams(events);
  assertEquals(streams.length, 2);
  const ios = streams.find((s) => s.stream.platform === 'ios')!;
  assertEquals(ios.stream.job, 'ttportal_app');
  assertEquals(ios.values.length, 2);
  assertEquals(ios.values[0][0], (BigInt(NOW) * 1000000n).toString());
});
