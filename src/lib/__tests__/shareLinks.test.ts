import { playerUrl, playerLogMatchUrl, parseQuickMatchUserId, joinUrl } from '../shareLinks';

describe('Quick Match deep links (F034)', () => {
  it('builds a player URL', () => {
    expect(playerUrl('u123')).toMatch(/\/player\/u123$/);
  });

  it('builds a log-match QR URL with the ?logMatch=1 flag', () => {
    const url = playerLogMatchUrl('u123');
    expect(url).toMatch(/\/player\/u123\?logMatch=1$/);
  });

  it('round-trips: a built QR URL parses back to the same user id', () => {
    expect(parseQuickMatchUserId(playerLogMatchUrl('abc-def'))).toBe('abc-def');
  });

  it('parses the user id out of any /player/<id> URL', () => {
    expect(parseQuickMatchUserId('https://example.com/x/player/zzz?logMatch=1')).toBe('zzz');
    expect(parseQuickMatchUserId('https://example.com/player/qqq')).toBe('qqq');
  });

  it('decodes percent-encoded ids', () => {
    expect(parseQuickMatchUserId('https://x/player/a%2Bb')).toBe('a+b');
  });

  it('returns null for non-player URLs / garbage', () => {
    expect(parseQuickMatchUserId('https://example.com/venue/5')).toBeNull();
    expect(parseQuickMatchUserId('not a url')).toBeNull();
    expect(parseQuickMatchUserId('')).toBeNull();
  });
});

describe('Referral links (F041)', () => {
  it('builds a /join/<code> URL from a referral code', () => {
    expect(joinUrl('RADU42')).toMatch(/\/join\/RADU42$/);
  });
});
