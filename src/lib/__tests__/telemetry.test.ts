// T080/T081: crash-reporting + analytics queue behavior.
import { createMMKV } from 'react-native-mmkv';
import {
  reportCrash,
  trackEvent,
  scrubPII,
  setAnalyticsOptOut,
  isAnalyticsOptedOut,
  __internal,
} from '../telemetry';

const store = createMMKV({ id: 'telemetry' });

beforeEach(() => {
  jest.clearAllMocks();
  setAnalyticsOptOut(false);
});

describe('scrubPII', () => {
  it('redacts emails, JWTs, and UUIDs', () => {
    const input =
      'user ana@example.com (id 123e4567-e89b-42d3-a456-426614174000) sent eyJhbGciOi.eyJzdWIi.SflKxwRJ';
    const out = scrubPII(input);
    expect(out).not.toContain('ana@example.com');
    expect(out).not.toContain('123e4567');
    expect(out).not.toContain('eyJhbGciOi');
    expect(out).toContain('[email]');
    expect(out).toContain('[uuid]');
    expect(out).toContain('[token]');
  });
});

describe('reportCrash', () => {
  it('queues a scrubbed crash with stack and never throws', () => {
    const err = new Error('boom for ana@example.com');
    expect(() => reportCrash(err, { screen: 'Map' })).not.toThrow();
    const queue = __internal.loadQueue();
    const crash = queue[queue.length - 1];
    expect(crash.kind).toBe('crash');
    expect(crash.name).toContain('[email]');
    expect(crash.name).not.toContain('ana@example.com');
    expect(crash.data?.screen).toBe('Map');
    expect(typeof crash.data?.stack).toBe('string');
  });

  it('is NOT gated by the analytics opt-out', () => {
    setAnalyticsOptOut(true);
    const before = __internal.loadQueue().length;
    reportCrash(new Error('still reported'));
    expect(__internal.loadQueue().length).toBe(before + 1);
  });
});

describe('trackEvent', () => {
  it('queues product events with platform/version metadata', () => {
    trackEvent('checkin_completed', { venueId: 42 });
    const queue = __internal.loadQueue();
    const evt = queue[queue.length - 1];
    expect(evt).toEqual(
      expect.objectContaining({
        kind: 'event',
        name: 'checkin_completed',
        platform: expect.any(String),
        ts: expect.any(Number),
      }),
    );
    expect(evt.data?.venueId).toBe(42);
  });

  it('respects the GDPR opt-out', () => {
    setAnalyticsOptOut(true);
    expect(isAnalyticsOptedOut()).toBe(true);
    const before = __internal.loadQueue().length;
    trackEvent('checkin_completed');
    expect(__internal.loadQueue().length).toBe(before);
  });
});

describe('flush', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('ships a batch to the ingest function and trims the queue', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    trackEvent('a');
    trackEvent('b');
    const queued = __internal.loadQueue().length;
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 202 });
    global.fetch = mockFetch as any;

    await __internal.flush();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/ingest-telemetry',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.events.length).toBe(queued);
    expect(__internal.loadQueue()).toHaveLength(0);
  });

  it('keeps the queue when the network fails', async () => {
    trackEvent('offline-event');
    const before = __internal.loadQueue().length;
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as any;

    await __internal.flush();

    expect(__internal.loadQueue().length).toBe(before);
  });
});
