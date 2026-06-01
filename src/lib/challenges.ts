export interface Challenge {
  id: string;
  month: number; // 1-12
  year: number;
  titleKey: string;    // i18n key
  descKey: string;     // i18n key
  icon: string;        // lucide icon name
  target: number;
  type: 'checkins' | 'venues' | 'reviews';
}

// Rotating monthly challenges
export function getCurrentChallenge(): Challenge {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Cycle through challenge types based on month
  const challenges: Omit<Challenge, 'month' | 'year'>[] = [
    { id: 'explorer', titleKey: 'challengeExplorerTitle', descKey: 'challengeExplorerDesc', icon: 'compass', target: 3, type: 'venues' },
    { id: 'active', titleKey: 'challengeActiveTitle', descKey: 'challengeActiveDesc', icon: 'zap', target: 8, type: 'checkins' },
    { id: 'critic', titleKey: 'challengeCriticTitle', descKey: 'challengeCriticDesc', icon: 'pen-line', target: 3, type: 'reviews' },
  ];

  const challenge = challenges[month % challenges.length];
  return { ...challenge, month, year };
}

export function getChallengeProgress(
  challenge: Challenge,
  stats: { monthCheckins: number; monthVenues: number; monthReviews: number },
): number {
  switch (challenge.type) {
    case 'checkins': return Math.min(stats.monthCheckins, challenge.target);
    case 'venues': return Math.min(stats.monthVenues, challenge.target);
    case 'reviews': return Math.min(stats.monthReviews, challenge.target);
    default: return 0;
  }
}
