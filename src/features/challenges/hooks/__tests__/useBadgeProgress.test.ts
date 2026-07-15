import { buildMonthlyProgressRows } from '../useBadgeProgress';
import type { ApprovedChallengeCompletion, ChallengeCategory, UserBadgeProgress } from '../../types';

function makeStoredProgress(category: UserBadgeProgress['category'], count: number): UserBadgeProgress {
  return {
    id: `progress-${category}`,
    user_id: 'user-1',
    category,
    completed_count: count,
    approved_count: count,
    xp: count * 100,
    badge_level: 'bronze',
    last_completed_at: '2026-03-20T10:00:00.000Z',
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-20T10:00:00.000Z',
  };
}

function makeCompletion(
  category: ChallengeCategory,
  completedAt: string,
): ApprovedChallengeCompletion {
  return {
    id: `completion-${category}-${completedAt}`,
    challenge_id: `challenge-${category}`,
    event_id: null,
    status: 'approved',
    submitted_at: completedAt,
    reviewed_at: null,
    challenges: { category },
  };
}

describe('buildMonthlyProgressRows', () => {
  it('counts only current-month completions and resets stale stored progress', () => {
    const rows = buildMonthlyProgressRows(
      'user-1',
      [
        makeStoredProgress('serve_lab', 12),
        makeStoredProgress('competitor', 5),
      ],
      [
        makeCompletion('serve_lab', '2026-03-20T23:59:00.000Z'),
        makeCompletion('serve_lab', '2026-04-02T00:00:00.000Z'),
        makeCompletion('serve_lab', '2026-04-12T09:30:00.000Z'),
      ],
      new Date('2026-04-16T12:00:00.000Z'),
    );

    const byCategory = new Map(rows.map((row) => [row.category, row]));

    expect(byCategory.get('serve_lab')?.completed_count).toBe(2);
    expect(byCategory.get('serve_lab')?.badge_level).toBe('none');
    expect(byCategory.get('serve_lab')?.last_completed_at).toBe('2026-04-12T09:30:00.000Z');
    expect(byCategory.get('competitor')?.completed_count).toBe(0);
    expect(byCategory.get('competitor')?.last_completed_at).toBeNull();
  });

  it('creates monthly progress rows for categories missing from stored progress', () => {
    const rows = buildMonthlyProgressRows(
      'user-1',
      [],
      Array.from({ length: 5 }, (_, index) => (
        makeCompletion('explorer', `2026-04-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`)
      )),
      new Date('2026-04-16T12:00:00.000Z'),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      category: 'explorer',
      completed_count: 5,
      badge_level: 'bronze',
    });
  });

  it('updates monthly tier progress when an event challenge is confirmed by another player', () => {
    const rows = buildMonthlyProgressRows(
      'player-1',
      [makeStoredProgress('first_attack_burst', 4)],
      [
        ...Array.from({ length: 4 }, (_, index) => (
          makeCompletion('first_attack_burst', `2026-04-${String(index + 3).padStart(2, '0')}T18:00:00.000Z`)
        )),
        {
          ...makeCompletion('first_attack_burst', '2026-04-16T18:15:00.000Z'),
          id: 'event-confirmed-submission',
          challenge_id: 'event-challenge-1',
          event_id: 77,
          reviewed_at: '2026-04-16T18:20:00.000Z',
        },
      ],
      new Date('2026-04-17T10:00:00.000Z'),
    );

    const progress = rows.find((row) => row.category === 'first_attack_burst');

    expect(progress).toMatchObject({
      completed_count: 5,
      approved_count: 5,
      badge_level: 'bronze',
      last_completed_at: '2026-04-16T18:20:00.000Z',
    });
  });
});
