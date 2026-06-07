import type { DbChallenge, EventChallengeSubmission, PendingChallengeValidation } from './types';

type Translate = (key: string, ...args: string[]) => string;

export type ChallengeTitleSource = DbChallenge | EventChallengeSubmission | PendingChallengeValidation;

function rowTitle(challenge: ChallengeTitleSource) {
  if ('challenge_title' in challenge) return challenge.challenge_title;
  return challenge.title;
}

export function resolveChallengeTitle(s: Translate, challenge: ChallengeTitleSource) {
  const titleKey = 'challenge_title_key' in challenge ? challenge.challenge_title_key : challenge.title_key;
  const keyedTitle = titleKey ? s(titleKey) : '';
  if (keyedTitle && keyedTitle !== titleKey) return keyedTitle;
  if (titleKey?.startsWith('badgeChallenge_')) return rowTitle(challenge);

  const legacyCode = 'challenge_legacy_code' in challenge ? challenge.challenge_legacy_code : challenge.legacy_code;
  const legacyKey = legacyCode ? `badgeChallenge_${legacyCode}` : null;
  const legacyTitle = legacyKey ? s(legacyKey) : '';
  if (legacyTitle && legacyTitle !== legacyKey) return legacyTitle;

  return rowTitle(challenge);
}

export function requiresOtherPlayer(challenge: Pick<DbChallenge, 'verification_type'>) {
  return challenge.verification_type === 'other';
}
