import { getCurrentChallenge, getChallengeProgress } from '../challenges';

describe('challenges', () => {
  describe('getCurrentChallenge', () => {
    it('returns a challenge with required fields', () => {
      const challenge = getCurrentChallenge();
      expect(challenge.id).toBeTruthy();
      expect(challenge.titleKey).toBeTruthy();
      expect(challenge.descKey).toBeTruthy();
      expect(challenge.icon).toBeTruthy();
      expect(challenge.target).toBeGreaterThan(0);
      expect(['checkins', 'venues', 'reviews']).toContain(challenge.type);
      expect(challenge.month).toBeGreaterThanOrEqual(1);
      expect(challenge.month).toBeLessThanOrEqual(12);
    });
  });

  describe('getChallengeProgress', () => {
    it('returns checkin count for checkins challenge', () => {
      const challenge = { id: 'active', titleKey: '', descKey: '', icon: '', target: 8, type: 'checkins' as const, month: 1, year: 2026 };
      const progress = getChallengeProgress(challenge, { monthCheckins: 5, monthVenues: 2, monthReviews: 1 });
      expect(progress).toBe(5);
    });

    it('returns venue count for venues challenge', () => {
      const challenge = { id: 'explorer', titleKey: '', descKey: '', icon: '', target: 3, type: 'venues' as const, month: 1, year: 2026 };
      const progress = getChallengeProgress(challenge, { monthCheckins: 5, monthVenues: 2, monthReviews: 1 });
      expect(progress).toBe(2);
    });

    it('returns review count for reviews challenge', () => {
      const challenge = { id: 'critic', titleKey: '', descKey: '', icon: '', target: 3, type: 'reviews' as const, month: 1, year: 2026 };
      const progress = getChallengeProgress(challenge, { monthCheckins: 5, monthVenues: 2, monthReviews: 1 });
      expect(progress).toBe(1);
    });

    it('caps progress at target', () => {
      const challenge = { id: 'active', titleKey: '', descKey: '', icon: '', target: 3, type: 'checkins' as const, month: 1, year: 2026 };
      const progress = getChallengeProgress(challenge, { monthCheckins: 10, monthVenues: 0, monthReviews: 0 });
      expect(progress).toBe(3);
    });
  });
});
