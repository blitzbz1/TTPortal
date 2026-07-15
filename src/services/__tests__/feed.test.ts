import { getCrossedPaths, dismissCrossedPath } from '../feed';

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

beforeEach(() => jest.clearAllMocks());

describe('getCrossedPaths (F022)', () => {
  // Implementation calls get_crossed_paths (migration 117), which derives the
  // caller from auth.uid() and excludes friends/blocked/dismissed server-side.
  it('passes no identity to the RPC (auth.uid() server-side)', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await getCrossedPaths();
    expect(mockRpc).toHaveBeenCalledWith('get_crossed_paths', {});
  });

  it('maps RPC rows to the CrossedPath shape', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          user_id: 'u2', full_name: 'Bogdan', avatar_url: null, city: 'Cluj',
          username: 'bogdan', skill_level: 'club', venue_id: 7,
          venue_name: 'Stadtpark', shared_count: 2, last_crossed_at: '2026-06-10T18:00:00Z',
        },
      ],
      error: null,
    });
    const { data } = await getCrossedPaths();
    expect(data).toEqual([
      {
        userId: 'u2', fullName: 'Bogdan', avatarUrl: null, city: 'Cluj',
        username: 'bogdan', skillLevel: 'club', venueId: 7,
        venueName: 'Stadtpark', sharedCount: 2, lastCrossedAt: '2026-06-10T18:00:00Z',
      },
    ]);
  });

  it('returns empty data and the error on RPC failure', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { data, error } = await getCrossedPaths();
    expect(data).toEqual([]);
    expect(error).toEqual({ message: 'boom' });
  });
});

describe('dismissCrossedPath (F022)', () => {
  it('calls dismiss_crossed_path with the target user id', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const { error } = await dismissCrossedPath('u2');
    expect(mockRpc).toHaveBeenCalledWith('dismiss_crossed_path', { p_user_id: 'u2' });
    expect(error).toBeNull();
  });
});
