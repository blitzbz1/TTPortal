import { getVenueChampion } from '../checkins';

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

describe('getVenueChampion', () => {
  beforeEach(() => mockRpc.mockReset());

  it('returns the row from get_venue_champion RPC mapped into the legacy shape', async () => {
    mockRpc.mockResolvedValue({
      data: [{ user_id: 'u1', full_name: 'Champion', day_count: 3 }],
      error: null,
    });

    const result = await getVenueChampion(1);

    expect(mockRpc).toHaveBeenCalledWith('get_venue_champion', { p_venue_id: 1, p_days_back: 30 });
    expect(result.data).toEqual({ userId: 'u1', fullName: 'Champion', dayCount: 3 });
  });

  it('returns null when no champion qualifies', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const result = await getVenueChampion(1);
    expect(result.data).toBeNull();
  });

  it('falls back to "?" when full_name is null', async () => {
    mockRpc.mockResolvedValue({
      data: [{ user_id: 'u1', full_name: null, day_count: 2 }],
      error: null,
    });
    const result = await getVenueChampion(1);
    expect(result.data?.fullName).toBe('?');
  });
});
