import { getVisibleChallengeChoices } from '../challengeAvailability';
import type { ChallengeCategory, DbChallenge } from '../types';

function makeChallenge(id: string, category: ChallengeCategory = 'serve_lab'): DbChallenge {
  return {
    id,
    code: id,
    legacy_code: null,
    title_key: null,
    category,
    title: `Challenge ${id}`,
    description: null,
    verification_type: 'other',
    requires_proof: false,
  };
}

describe('getVisibleChallengeChoices', () => {
  it('removes an event-confirmed challenge and fills the four-card batch with the next choice', () => {
    const choices = [
      makeChallenge('challenge-1'),
      makeChallenge('challenge-2'),
      makeChallenge('challenge-3'),
      makeChallenge('challenge-4'),
      makeChallenge('challenge-5'),
    ];

    const visible = getVisibleChallengeChoices(
      choices,
      new Set(['challenge-1']),
      new Set(),
    );

    expect(visible.map((challenge) => challenge.id)).toEqual([
      'challenge-2',
      'challenge-3',
      'challenge-4',
      'challenge-5',
    ]);
  });

  it('keeps pending, approved, and just-completed challenges out of the next batch', () => {
    const choices = [
      makeChallenge('pending-event-challenge'),
      makeChallenge('approved-event-challenge'),
      makeChallenge('completed-this-session'),
      makeChallenge('fresh-1'),
      makeChallenge('fresh-2'),
      makeChallenge('fresh-3'),
      makeChallenge('fresh-4'),
    ];

    const visible = getVisibleChallengeChoices(
      choices,
      new Set(['pending-event-challenge', 'approved-event-challenge']),
      new Set(['completed-this-session']),
    );

    expect(visible.map((challenge) => challenge.id)).toEqual([
      'fresh-1',
      'fresh-2',
      'fresh-3',
      'fresh-4',
    ]);
  });
});
