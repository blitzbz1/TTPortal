// T070: leaderboard view selection, column pinning, weekly RPC routing +
// the client-side fallback when an RPC errors.
import { createQueryChain } from '../../test-utils/supabaseMock';
import { getLeaderboard } from '../leaderboard';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

beforeEach(() => jest.clearAllMocks());

describe('all-time leaderboards', () => {
  it.each([
    ['checkins', 'leaderboard_checkins', 'total_checkins'],
    ['reviews', 'leaderboard_reviews', 'total_reviews'],
    ['venues', 'leaderboard_venues', 'venues_added'],
  ] as const)('%s reads its view with pinned columns', async (type, view, scoreCol) => {
    const chain = createQueryChain([]);
    mockFrom.mockReturnValue(chain);

    await getLeaderboard(type);

    expect(mockFrom).toHaveBeenCalledWith(view);
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining(scoreCol));
    expect(chain.order).toHaveBeenCalledWith('rank', { ascending: true });
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it('applies the city filter when provided', async () => {
    const chain = createQueryChain([]);
    mockFrom.mockReturnValue(chain);
    await getLeaderboard('checkins', 'Wien');
    expect(chain.eq).toHaveBeenCalledWith('city', 'Wien');
  });
});

describe('weekly leaderboards', () => {
  it('routes to the weekly RPC with a 7-day watermark', async () => {
    mockRpc.mockResolvedValue({ data: [{ user_id: 'u-1' }], error: null });

    const { data, error } = await getLeaderboard('checkins', undefined, 'week');

    expect(mockRpc).toHaveBeenCalledWith('weekly_leaderboard_checkins', {
      since: expect.any(String),
    });
    const since = new Date(mockRpc.mock.calls[0][1].since).getTime();
    expect(Date.now() - since).toBeGreaterThan(6.9 * 24 * 3600 * 1000);
    expect(Date.now() - since).toBeLessThan(7.1 * 24 * 3600 * 1000);
    expect(data).toEqual([{ user_id: 'u-1' }]);
    expect(error).toBeNull();
  });

  it('falls back to client-side aggregation when the RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'missing' } });
    const chain = createQueryChain([
      { user_id: 'u-1', profiles: { full_name: 'Ana' } },
      { user_id: 'u-1', profiles: { full_name: 'Ana' } },
      { user_id: 'u-2', profiles: { full_name: 'Bo' } },
    ]);
    mockFrom.mockReturnValue(chain);

    const { data, error } = await getLeaderboard('checkins', undefined, 'week');

    expect(mockFrom).toHaveBeenCalledWith('checkins');
    expect(chain.gte).toHaveBeenCalledWith('started_at', expect.any(String));
    expect(error).toBeNull();
    expect((data as any[])[0]).toEqual(expect.objectContaining({ user_id: 'u-1', total_checkins: 2 }));
  });
});
