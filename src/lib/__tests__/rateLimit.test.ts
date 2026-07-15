import {
  parseRateLimitError,
  formatRateLimitMessage,
  rateLimitMessageFor,
} from '../rateLimit';

const s = (k: string) => k;

describe('parseRateLimitError', () => {
  it('parses a per-user rate limit message', () => {
    expect(parseRateLimitError({ message: 'rate_limit_exceeded:user:add_venue:600:10' }))
      .toEqual({ kind: 'user', action: 'add_venue', windowSecs: 600, max: 10 });
  });

  it('parses a per-IP rate limit message', () => {
    expect(parseRateLimitError({ message: 'rate_limit_exceeded:ip:*:60:120' }))
      .toEqual({ kind: 'ip', action: '*', windowSecs: 60, max: 120 });
  });

  it('parses an explicit IP block message', () => {
    expect(parseRateLimitError({ message: 'ip_blocked:203.0.113.5' }))
      .toEqual({ kind: 'ip_blocked', ip: '203.0.113.5' });
  });

  it('reads from `details` when `message` is absent', () => {
    expect(parseRateLimitError({ details: 'rate_limit_exceeded:user:checkin:300:10' }))
      .toEqual({ kind: 'user', action: 'checkin', windowSecs: 300, max: 10 });
  });

  it('returns null for unrelated errors', () => {
    expect(parseRateLimitError({ message: 'duplicate key violates uniqueness' })).toBeNull();
    expect(parseRateLimitError(null)).toBeNull();
    expect(parseRateLimitError(undefined)).toBeNull();
    expect(parseRateLimitError({})).toBeNull();
  });
});

describe('formatRateLimitMessage', () => {
  it('uses the per-action key for known user-scope actions', () => {
    expect(formatRateLimitMessage(
      { kind: 'user', action: 'add_venue', windowSecs: 600, max: 10 },
      s,
    )).toBe('rateLimitAddVenue');
    expect(formatRateLimitMessage(
      { kind: 'user', action: 'create_event', windowSecs: 86400, max: 10 },
      s,
    )).toBe('rateLimitCreateEvent');
    expect(formatRateLimitMessage(
      { kind: 'user', action: 'checkin', windowSecs: 300, max: 10 },
      s,
    )).toBe('rateLimitCheckin');
  });

  it('falls back to a generic key for unknown user-scope actions', () => {
    expect(formatRateLimitMessage(
      { kind: 'user', action: 'something_new', windowSecs: 60, max: 1 },
      s,
    )).toBe('rateLimitGeneric');
  });

  it('substitutes {minutes} from the window', () => {
    const sExpand = (k: string) =>
      ({ rateLimitAddVenue: 'wait {minutes} min', rateLimitIp: 'ip wait {minutes}' }[k] ?? k);
    expect(formatRateLimitMessage(
      { kind: 'user', action: 'add_venue', windowSecs: 600, max: 10 },
      sExpand,
    )).toBe('wait 10 min');
    expect(formatRateLimitMessage(
      { kind: 'ip', action: '*', windowSecs: 60, max: 120 },
      sExpand,
    )).toBe('ip wait 1');
  });

  it('clamps under-1-minute windows to "1" so the copy never says "0 minutes"', () => {
    const sExpand = (k: string) => k === 'rateLimitGeneric' ? '{minutes}' : k;
    expect(formatRateLimitMessage(
      { kind: 'user', action: 'unknown', windowSecs: 5, max: 1 },
      sExpand,
    )).toBe('1');
  });
});

describe('rateLimitMessageFor', () => {
  it('returns the formatted copy when the error is a rate limit', () => {
    const sExpand = (k: string) =>
      k === 'rateLimitAddVenue' ? 'wait {minutes}' : k;
    expect(rateLimitMessageFor(
      { message: 'rate_limit_exceeded:user:add_venue:600:10' },
      sExpand,
    )).toBe('wait 10');
  });

  it('returns null for non-rate-limit errors so the caller can fall through', () => {
    expect(rateLimitMessageFor({ message: 'unrelated' }, s)).toBeNull();
  });
});
