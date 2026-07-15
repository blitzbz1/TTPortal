import { getPlayerRating } from '../ratings';
import { shouldCelebrateRating } from '../../lib/ratingsCache';

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

beforeEach(() => jest.clearAllMocks());

describe('getPlayerRating (F030)', () => {
  it('forwards p_user_id and maps the rating bundle', async () => {
    mockRpc.mockResolvedValue({
      data: { rating: 1320, peak: 1350, matches: 12, provisional: false, spark: [1300, 1320], last5: [20, -10] },
      error: null,
    });
    const { data } = await getPlayerRating('u1');
    expect(mockRpc).toHaveBeenCalledWith('get_player_rating', { p_user_id: 'u1' });
    expect(data).toEqual({
      rating: 1320, peak: 1350, matches: 12, provisional: false, spark: [1300, 1320], last5: [20, -10],
    });
  });

  it('returns null for an unrated player (null data)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const { data } = await getPlayerRating('u2');
    expect(data).toBeNull();
  });

  it('defaults spark/last5 to [] when absent', async () => {
    mockRpc.mockResolvedValue({
      data: { rating: 1200, peak: 1200, matches: 0, provisional: true, spark: null, last5: null },
      error: null,
    });
    const { data } = await getPlayerRating('u3');
    expect(data?.spark).toEqual([]);
    expect(data?.last5).toEqual([]);
  });
});

describe('shouldCelebrateRating (F030)', () => {
  it('celebrates only on an increase past the last-seen (base 1200)', () => {
    expect(shouldCelebrateRating(1220, 1200)).toBe(true);
    expect(shouldCelebrateRating(1200, 1200)).toBe(false);
    expect(shouldCelebrateRating(1180, 1200)).toBe(false);
    expect(shouldCelebrateRating(1220, null)).toBe(true); // first win vs base
    expect(shouldCelebrateRating(1200, null)).toBe(false);
    expect(shouldCelebrateRating(null, 1200)).toBe(false);
  });
});
