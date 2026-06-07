import { resolveChallengeTitle } from '../challengeTitles';
import type { DbChallenge } from '../types';

function makeChallenge(overrides: Partial<DbChallenge> = {}): DbChallenge {
  return {
    id: 'challenge-id',
    code: 'CRF201',
    legacy_code: 'BRZ004',
    title_key: 'badgeChallenge_CRF201',
    category: 'craft_player',
    title: 'Pack 2 canonical title',
    description: null,
    verification_type: 'other',
    requires_proof: false,
    ...overrides,
  };
}

describe('resolveChallengeTitle', () => {
  it('uses the translated explicit title key when available', () => {
    const challenge = makeChallenge();
    const s = (key: string) => (
      key === 'badgeChallenge_CRF201' ? 'Translated Pack 2 title' : key
    );

    expect(resolveChallengeTitle(s, challenge)).toBe('Translated Pack 2 title');
  });

  it('does not fall through to legacy-code translations for missing explicit badge keys', () => {
    const challenge = makeChallenge();
    const s = (key: string) => (
      key === 'badgeChallenge_BRZ004' ? 'Legacy Pack 1 title' : key
    );

    expect(resolveChallengeTitle(s, challenge)).toBe('Pack 2 canonical title');
  });

  it('still supports legacy-code fallback for rows without an explicit title key', () => {
    const challenge = makeChallenge({ title_key: null });
    const s = (key: string) => (
      key === 'badgeChallenge_BRZ004' ? 'Legacy Pack 1 title' : key
    );

    expect(resolveChallengeTitle(s, challenge)).toBe('Legacy Pack 1 title');
  });
});
