import { getLeaderboard, getCityLadder, getMyLadderStanding } from '../leaderboard';

const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: (...args: any[]) => mockFrom(...args),
  },
}));

beforeEach(() => jest.clearAllMocks());

describe('city ladder (F033)', () => {
  it('getCityLadder forwards city + season + limit', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await getCityLadder('Cluj');
    expect(mockRpc).toHaveBeenCalledWith('get_city_ladder', { p_city: 'Cluj', p_season_id: null, p_limit: 50 });
  });

  it('getLeaderboard routes type=ladder to the ladder RPC (not the views)', async () => {
    mockRpc.mockResolvedValue({ data: [{ user_id: 'a', rank: 1, rating: 1300 }], error: null });
    const { data } = await getLeaderboard('ladder', 'Cluj', 'all');
    expect(mockRpc).toHaveBeenCalledWith('get_city_ladder', { p_city: 'Cluj', p_season_id: null, p_limit: 50 });
    expect(mockFrom).not.toHaveBeenCalled();
    expect((data as any[])[0].rank).toBe(1);
  });

  it('getMyLadderStanding forwards the city and returns the standing', async () => {
    mockRpc.mockResolvedValue({ data: { played: 3, placed: false, rank: null, needed: 5 }, error: null });
    const { data } = await getMyLadderStanding('Cluj');
    expect(mockRpc).toHaveBeenCalledWith('get_my_ladder_standing', { p_city: 'Cluj' });
    expect(data).toEqual({ played: 3, placed: false, rank: null, needed: 5 });
  });
});
