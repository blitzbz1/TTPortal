import { summarizeMatches } from '../matches';
import type { PlayerMatch } from '../matches';

const mk = (over: Partial<PlayerMatch>): PlayerMatch => ({
  id: 1,
  reporter_id: 'me',
  opponent_id: 'you',
  winner_id: 'me',
  sets: [],
  venue_id: null,
  event_id: null,
  status: 'confirmed',
  created_at: '',
  confirmed_at: null,
  reporter_name: null,
  opponent_name: null,
  ...over,
});

describe('summarizeMatches (F002)', () => {
  it('counts W/L over confirmed matches with a winner, from the user perspective', () => {
    const matches = [
      mk({ id: 1, winner_id: 'me', status: 'confirmed' }),
      mk({ id: 2, winner_id: 'you', status: 'confirmed' }),
      mk({ id: 3, winner_id: 'me', status: 'confirmed' }),
      mk({ id: 4, winner_id: 'me', status: 'pending' }), // ignored: not confirmed
      mk({ id: 5, winner_id: null, status: 'confirmed' }), // ignored: no winner
      mk({ id: 6, winner_id: 'you', status: 'void' }), // ignored: void
    ];
    expect(summarizeMatches(matches, 'me')).toEqual({ wins: 2, losses: 1, total: 3 });
  });

  it('returns zeros for an empty history', () => {
    expect(summarizeMatches([], 'me')).toEqual({ wins: 0, losses: 0, total: 0 });
  });
});
