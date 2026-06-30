import {
  BADGE_TRACKS,
  RECRUITER_TRACK_ID,
  RECRUITER_TIER_TARGETS,
} from '../badgeDefinitions';
import {
  getEarnedAtByBadgeTier,
  getTrackProgressSummaries,
  getFeaturedTrackSummary,
  getMonthlyMasterySummary,
} from '../progression';
import type { ApprovedChallengeCompletion, BadgeAward, UserBadgeProgress } from '../types';

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

  it('uses actual monthly tier-crossing dates instead of stale badge award dates', () => {
    const completions: ApprovedChallengeCompletion[] = Array.from({ length: 30 }, (_, index) => {
      const submittedAt = index < 5
        ? `2026-04-${String(index + 1).padStart(2, '0')}T10:00:00Z`
        : index < 15
          ? `2026-05-${String(index - 4).padStart(2, '0')}T10:00:00Z`
          : `2026-06-${String(index - 14).padStart(2, '0')}T10:00:00Z`;
      return {
        id: `c${index}`,
        challenge_id: `challenge-${index}`,
        event_id: null,
        status: 'auto_approved',
        submitted_at: submittedAt,
        reviewed_at: null,
        challenges: { category: 'craft_player' },
      } as ApprovedChallengeCompletion;
    });
    const awards: BadgeAward[] = [
      {
        id: 'bronze-award',
        user_id: 'u1',
        category: 'craft_player',
        tier: 'bronze',
        completed_count: 5,
        awarded_at: '2026-04-05T10:00:00Z',
        source_submission_id: 'c4',
        created_at: '2026-04-05T10:00:00Z',
      } as BadgeAward,
      {
        id: 'silver-award',
        user_id: 'u1',
        category: 'craft_player',
        tier: 'silver',
        completed_count: 10,
        awarded_at: '2026-04-05T10:00:00Z',
        source_submission_id: 'c9',
        created_at: '2026-04-05T10:00:00Z',
      } as BadgeAward,
      {
        id: 'gold-award',
        user_id: 'u1',
        category: 'craft_player',
        tier: 'gold',
        completed_count: 15,
        awarded_at: '2026-04-05T10:00:00Z',
        source_submission_id: 'c14',
        created_at: '2026-04-05T10:00:00Z',
      } as BadgeAward,
    ];

    const earnedAt = getEarnedAtByBadgeTier(completions, awards);

    expect(earnedAt.get('craft_player:bronze')).toBe('2026-04-05T10:00:00Z');
    expect(earnedAt.get('craft_player:silver')).toBe('2026-05-10T10:00:00Z');
    expect(earnedAt.get('craft_player:gold')).toBe('2026-06-15T10:00:00Z');
  });

  it('falls back to current monthly progress rows when the badge award row is missing', () => {
    const progressRows: UserBadgeProgress[] = [
      {
        id: 'p1',
        user_id: 'u1',
        category: 'craft_player',
        completed_count: 5,
        approved_count: 5,
        xp: 50,
        badge_level: 'bronze',
        last_completed_at: '2026-06-26T08:00:00Z',
        created_at: '2026-06-01T00:00:00Z',
        updated_at: '2026-06-26T08:00:00Z',
      },
    ];

    const earnedAt = getEarnedAtByBadgeTier([], [], progressRows);

    expect(earnedAt.get('craft_player:bronze')).toBe('2026-06-26T08:00:00Z');
    expect(earnedAt.has('craft_player:silver')).toBe(false);
  });
});
