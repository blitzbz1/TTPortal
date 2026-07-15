// F053: milestone catalog + ghost-progress logic.
import {
  MILESTONE_DEFS,
  MILESTONE_DEF_BY_KEY,
  nextMilestoneGhost,
  milestoneCurrent,
  yearsSince,
  type MilestoneCounters,
} from '../definitions';

const counters = (over: Partial<MilestoneCounters> = {}): MilestoneCounters => ({
  checkins: 0,
  venues: 0,
  hours: 0,
  reviews: 0,
  years: 0,
  ...over,
});

describe('milestone definitions (F053)', () => {
  it('exposes the documented keys + thresholds matching the server workers', () => {
    expect(MILESTONE_DEF_BY_KEY.checkin_10.threshold).toBe(10);
    expect(MILESTONE_DEF_BY_KEY.checkin_50.threshold).toBe(50);
    expect(MILESTONE_DEF_BY_KEY.checkin_100.threshold).toBe(100);
    expect(MILESTONE_DEF_BY_KEY.venues_10.threshold).toBe(10);
    expect(MILESTONE_DEF_BY_KEY.venues_25.threshold).toBe(25);
    expect(MILESTONE_DEF_BY_KEY.hours_50.threshold).toBe(50);
    expect(MILESTONE_DEF_BY_KEY.hours_100.threshold).toBe(100);
    expect(MILESTONE_DEF_BY_KEY.hours_250.threshold).toBe(250);
    expect(MILESTONE_DEF_BY_KEY.first_review.metric).toBe('reviews');
    expect(MILESTONE_DEF_BY_KEY.anniversary_1y.metric).toBe('anniversary');
    // Exactly the 10 documented milestones, all with a title i18n key.
    expect(MILESTONE_DEFS).toHaveLength(10);
    expect(MILESTONE_DEFS.every((d) => d.titleKey.startsWith('milestone'))).toBe(true);
  });

  it('milestoneCurrent reads the right counter per metric', () => {
    const c = counters({ checkins: 7, venues: 3, hours: 42, reviews: 1, years: 2 });
    expect(milestoneCurrent(MILESTONE_DEF_BY_KEY.checkin_10, c)).toBe(7);
    expect(milestoneCurrent(MILESTONE_DEF_BY_KEY.venues_10, c)).toBe(3);
    expect(milestoneCurrent(MILESTONE_DEF_BY_KEY.hours_50, c)).toBe(42);
    expect(milestoneCurrent(MILESTONE_DEF_BY_KEY.first_review, c)).toBe(1);
    expect(milestoneCurrent(MILESTONE_DEF_BY_KEY.anniversary_1y, c)).toBe(2);
  });

  it('picks the closest unearned milestone as the next ghost', () => {
    // 38 venues, nothing earned: the smallest remaining gap among unearned defs.
    // venues_25 is already passed (38>25, remaining<0 → skipped); checkin_50
    // needs 12 (50-38), hours_50 needs 8 (50-42)… compute against real counters.
    const ghost = nextMilestoneGhost(
      new Set<string>(),
      counters({ checkins: 38, venues: 38, hours: 42, reviews: 0, years: 0 }),
    );
    expect(ghost).not.toBeNull();
    // hours_50 has the smallest remaining gap (8) vs checkin_50 (12).
    expect(ghost!.def.key).toBe('hours_50');
    expect(ghost!.current).toBe(42);
    expect(ghost!.threshold).toBe(50);
  });

  it('skips earned milestones when choosing a ghost', () => {
    const ghost = nextMilestoneGhost(
      new Set(['checkin_10', 'venues_10']),
      counters({ checkins: 12, venues: 12 }),
    );
    // checkin_10 + venues_10 earned; the next venue ghost is venues_25 (12/25).
    expect(ghost).not.toBeNull();
    expect(ghost!.def.key).toBe('venues_25');
    expect(ghost!.current).toBe(12);
  });

  it('returns null when every milestone with progress is earned', () => {
    const all = new Set(MILESTONE_DEFS.map((d) => d.key));
    const ghost = nextMilestoneGhost(all, counters({ checkins: 999, venues: 999, hours: 999 }));
    expect(ghost).toBeNull();
  });

  it('yearsSince floors to whole years and guards bad input', () => {
    const twoYearsAgo = new Date(Date.now() - 2.5 * 365.25 * 24 * 3600 * 1000).toISOString();
    expect(yearsSince(twoYearsAgo)).toBe(2);
    expect(yearsSince(null)).toBe(0);
    expect(yearsSince('not-a-date')).toBe(0);
  });
});
