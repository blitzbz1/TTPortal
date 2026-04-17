import type { DbChallenge } from './types';

export function getVisibleChallengeChoices(
  choices: DbChallenge[],
  blockedChallengeIds: Set<string>,
  completedSessionChallengeIds: Set<string>,
  visibleCount = 4,
) {
  return choices
    .filter((challenge) => !blockedChallengeIds.has(challenge.id))
    .filter((challenge) => !completedSessionChallengeIds.has(challenge.id))
    .slice(0, visibleCount);
}
