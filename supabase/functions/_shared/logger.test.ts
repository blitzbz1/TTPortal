// Local deno tests for the shared Edge Function logger (T020).
// Run with: deno test supabase/functions/_shared/
//
// These cover the pure, unit-testable surface: structured log output,
// request-id extraction, and the timer. (amatur-proxy itself is a fetch/
// cache proxy with no parsing logic — its behavior is covered by the
// client-side amatur service tests.)

import {
  createLogger,
  createTimer,
  getRequestId,
} from './logger.ts';

function captureConsole(fn: () => void): string[] {
  const lines: string[] = [];
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };
  const capture = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  console.log = capture;
  console.info = capture;
  console.warn = capture;
  console.error = capture;
  console.debug = capture;
  try {
    fn();
  } finally {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
    console.debug = original.debug;
  }
  return lines;
}

Deno.test('createLogger emits parseable JSON with level, function and message', () => {
  const logger = createLogger('test-fn');
  const lines = captureConsole(() => {
    logger.info('hello world', 'req-1', { foo: 'bar' });
  });
  if (lines.length !== 1) throw new Error(`expected 1 line, got ${lines.length}`);
  const entry = JSON.parse(lines[0]);
  if (entry.level !== 'info') throw new Error(`level: ${entry.level}`);
  if (entry.function_name !== 'test-fn' && entry.function !== 'test-fn') {
    throw new Error(`function name missing: ${lines[0]}`);
  }
  if (entry.message !== 'hello world') throw new Error(`message: ${entry.message}`);
});

Deno.test('logger.error serializes Error objects', () => {
  const logger = createLogger('test-fn');
  const lines = captureConsole(() => {
    logger.error('boom', 'req-2', new Error('kaput'), { attempt: 3 });
  });
  const entry = JSON.parse(lines[0]);
  if (entry.level !== 'error') throw new Error(`level: ${entry.level}`);
  if (!JSON.stringify(entry).includes('kaput')) {
    throw new Error(`error message not serialized: ${lines[0]}`);
  }
});

Deno.test('getRequestId reads x-request-id and returns null when absent', () => {
  const withHeader = new Request('https://x.test', {
    headers: { 'x-request-id': 'abc-123' },
  });
  const without = new Request('https://x.test');
  if (getRequestId(withHeader) !== 'abc-123') throw new Error('header not read');
  if (getRequestId(without) !== null) throw new Error('expected null');
});

Deno.test('createTimer measures elapsed time monotonically', async () => {
  const timer = createTimer();
  const first = timer.elapsed();
  await new Promise((resolve) => setTimeout(resolve, 15));
  const second = timer.elapsed();
  if (second < first) throw new Error('elapsed went backwards');
  if (second < 10) throw new Error(`expected >=10ms elapsed, got ${second}`);
});
