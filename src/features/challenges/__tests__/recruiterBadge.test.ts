import {
  BADGE_TRACKS,
  RECRUITER_TRACK_ID,
  RECRUITER_TIER_TARGETS,
} from '../badgeDefinitions';
import {
  getTrackProgressSummaries,
  getFeaturedTrackSummary,
  getMonthlyMasterySummary,
} from '../progression';
import type { BadgeAward, UserBadgeProgress } from '../types';

describe('Recruiter badge track (F041)', () => {
  const recruiter = BADGE_TRACKS.find((t) => t.id === RECRUITER_TRACK_ID);

  it('is a badge-only track (registered, no challenges)', () => {
    expect(recruiter).toBeDefined();
    expect(recruiter!.category).toBe('recruiter');
    expect(recruiter!.icon).toBe('user-plus');
    const total =
      recruiter!.challenges.bronze.length +
      recruiter!.challenges.silver.length +
      recruiter!.challenges.gold.length;
    expect(total).toBe(0);
  });

  it('uses 1/5/10 thresholds, not the global 5/10/15', () => {
    expect(RECRUITER_TIER_TARGETS).toEqual({ bronze: 1, silver: 5, gold: 10 });
  });

  it('renders an earned recruiter bronze chip from a badge_awards row', () => {
    const awards: BadgeAward[] = [
      {
        id: 'a1',
        user_id: 'u1',
        category: 'recruiter',
        tier: 'bronze',
        completed_count: 1,
        awarded_at: '2026-06-16T00:00:00Z',
        source_submission_id: null,
        created_at: '2026-06-16T00:00:00Z',
      } as BadgeAward,
    ];
    const summaries = getTrackProgressSummaries([], awards);
    const recruiterSummary = summaries.find((s) => s.badge.id === RECRUITER_TRACK_ID);
    expect(recruiterSummary).toBeDefined();
    expect(recruiterSummary!.earnedTiers).toContain('bronze');
  });

  it('is excluded from the challenge featured/mastery aggregates', () => {
    const progressRows: UserBadgeProgress[] = [];
    const awards: BadgeAward[] = [
      {
        id: 'a1',
        user_id: 'u1',
        category: 'recruiter',
        tier: 'bronze',
        completed_count: 1,
        awarded_at: '2026-06-16T00:00:00Z',
        source_submission_id: null,
        created_at: '2026-06-16T00:00:00Z',
      } as BadgeAward,
    ];
    const summaries = getTrackProgressSummaries(progressRows, awards);

    // The most recent award is the recruiter badge, but featured must pick a
    // real challenge track (recruiter has no challenge progress).
    const featured = getFeaturedTrackSummary(summaries);
    expect(featured.badge.id).not.toBe(RECRUITER_TRACK_ID);

    // Mastery's earned-this-month count ignores the badge-only recruiter tier.
    const mastery = getMonthlyMasterySummary(summaries);
    expect(mastery.earnedThisMonth).toBe(0);
    expect(mastery.strongest.badge.id).not.toBe(RECRUITER_TRACK_ID);
  });
});
