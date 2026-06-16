// F054 — Wrapped window gating + archetype/month maps.
import {
  isWrappedWindowOpen,
  wrappedYearFor,
  ARCHETYPE_LABEL_KEY,
  ARCHETYPE_DESC_KEY,
  MONTH_LABEL_KEY,
} from '../definitions';
import type { WrappedArchetype } from '../../../services/wrapped';

describe('isWrappedWindowOpen (F054)', () => {
  // Construct local-time dates (the helper reads getMonth/getDate in local time).
  const d = (m: number, day: number) => new Date(2026, m - 1, day, 12, 0, 0);

  it('is open from Dec 15 to Dec 31', () => {
    expect(isWrappedWindowOpen(d(12, 15))).toBe(true);
    expect(isWrappedWindowOpen(d(12, 25))).toBe(true);
    expect(isWrappedWindowOpen(d(12, 31))).toBe(true);
  });

  it('is open from Jan 1 to Jan 15', () => {
    expect(isWrappedWindowOpen(d(1, 1))).toBe(true);
    expect(isWrappedWindowOpen(d(1, 15))).toBe(true);
  });

  it('is closed before Dec 15 and after Jan 15', () => {
    expect(isWrappedWindowOpen(d(12, 14))).toBe(false);
    expect(isWrappedWindowOpen(d(1, 16))).toBe(false);
    expect(isWrappedWindowOpen(d(6, 16))).toBe(false);
    expect(isWrappedWindowOpen(d(11, 30))).toBe(false);
  });
});

describe('wrappedYearFor (F054)', () => {
  it('covers the current year in mid/late December', () => {
    expect(wrappedYearFor(new Date(2026, 11, 20, 12))).toBe(2026);
  });
  it('covers the PRIOR year in early January', () => {
    expect(wrappedYearFor(new Date(2027, 0, 5, 12))).toBe(2026);
  });
});

describe('archetype + month maps (F054)', () => {
  const archetypes: WrappedArchetype[] = [
    'grinder',
    'explorer',
    'social_player',
    'park_regular',
    'casual',
  ];

  it('has a label + description key for every archetype', () => {
    for (const a of archetypes) {
      expect(ARCHETYPE_LABEL_KEY[a]).toMatch(/^wrappedArchetype/);
      expect(ARCHETYPE_DESC_KEY[a]).toMatch(/^wrappedArchetype.*Desc$/);
    }
  });

  it('maps every calendar month 1-12', () => {
    for (let m = 1; m <= 12; m += 1) {
      expect(MONTH_LABEL_KEY[m]).toMatch(/^month/);
    }
  });
});
