jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: jest.fn(),
  },
}));

import { getProfileStats } from '../profiles';

describe('getProfileStats', () => {
  beforeEach(() => jest.clearAllMocks());

  // The implementation now calls a single RPC (get_profile_stats, see
  // migration 051) which does the SUM/COUNT server-side. The shape we
  // assert here mirrors the row the RPC returns. Whether Supabase
  // returns a one-element array or a single row (the version-dependent
  // behavior of supabase-js for table-returning RPCs), the service
  // unwraps both — covered by the two paths below.

  it('returns checkins and events count when the RPC yields an array row', async () => {
    mockRpc.mockResolvedValue({
      data: [{
        total_checkins: 15,
        unique_venues: 8,
        events_joined: 5,
        total_hours_played: 0,
      }],
      error: null,
    });

    const { data, error } = await getProfileStats('user-1');

    expect(mockRpc).toHaveBeenCalledWith('get_profile_stats', { p_user_id: 'user-1' });
    expect(data).toEqual({
      total_checkins: 15,
      unique_venues: 8,
      events_joined: 5,
      total_hours_played: 0,
    });
    expect(error).toBeNull();
  });

  it('also accepts a non-array row payload', async () => {
    mockRpc.mockResolvedValue({
      data: {
        total_checkins: 3,
        unique_venues: 2,
        events_joined: 4,
        total_hours_played: 4,
      },
      error: null,
    });
    const { data } = await getProfileStats('user-1');
    expect(data).toEqual({
      total_checkins: 3, unique_venues: 2, events_joined: 4, total_hours_played: 4,
    });
  });

  it('passes the user id through to the RPC', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await getProfileStats('user-42');
    expect(mockRpc).toHaveBeenCalledWith('get_profile_stats', { p_user_id: 'user-42' });
  });

  it('defaults to zero when the RPC returns no row', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const { data } = await getProfileStats('user-1');
    expect(data).toEqual({
      total_checkins: 0,
      unique_venues: 0,
      events_joined: 0,
      total_hours_played: 0,
    });
  });

  it('coerces a numeric-string total_hours_played (Postgres returns NUMERIC as string)', async () => {
    mockRpc.mockResolvedValue({
      data: [{ total_checkins: 0, unique_venues: 0, events_joined: 1, total_hours_played: '2.5' }],
      error: null,
    });
    const { data } = await getProfileStats('user-1');
    expect(data?.total_hours_played).toBe(2.5);
  });

  it('forwards RPC errors with safe defaults', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'db error' } });
    const { data, error } = await getProfileStats('user-1');
    expect(error).toEqual({ message: 'db error' });
    expect(data).toEqual({ total_checkins: 0, unique_venues: 0, events_joined: 0, total_hours_played: 0 });
  });
});
