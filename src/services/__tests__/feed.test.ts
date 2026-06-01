import { getFriendFeed } from '../feed';

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

beforeEach(() => jest.clearAllMocks());

describe('getFriendFeed', () => {
  // Implementation now calls the get_friend_feed RPC (migration 052)
  // which does the UNION ALL + ORDER BY + LIMIT server-side. The client
  // just rehydrates the FeedItem shape.

  it('returns empty array when no friend IDs provided', async () => {
    const result = await getFriendFeed([]);
    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
    // Short-circuits before making the RPC call.
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('passes the friend ids and limit to the RPC', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await getFriendFeed(['f1', 'f2'], 25);
    expect(mockRpc).toHaveBeenCalledWith('get_friend_feed', {
      p_friend_ids: ['f1', 'f2'],
      p_limit: 25,
    });
  });

  it('maps RPC rows to FeedItem shape', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          kind: 'review', id: 2, user_id: 'f2', user_name: 'Maria',
          venue_id: 20, venue_name: 'Parc Tineretului', venue_city: '',
          rating: 5, ts: '2026-04-01T11:00:00Z',
        },
        {
          kind: 'checkin', id: 1, user_id: 'f1', user_name: 'Andrei',
          venue_id: 10, venue_name: 'ClubPing', venue_city: 'Bucuresti',
          rating: null, ts: '2026-04-01T10:00:00Z',
        },
      ],
      error: null,
    });

    const { data } = await getFriendFeed(['f1', 'f2']);

    expect(data).toEqual([
      {
        id: 'review-2', type: 'review', userId: 'f2', userName: 'Maria',
        venueId: 20, venueName: 'Parc Tineretului', venueCity: undefined,
        rating: 5, timestamp: '2026-04-01T11:00:00Z',
      },
      {
        id: 'checkin-1', type: 'checkin', userId: 'f1', userName: 'Andrei',
        venueId: 10, venueName: 'ClubPing', venueCity: 'Bucuresti',
        rating: undefined, timestamp: '2026-04-01T10:00:00Z',
      },
    ]);
  });

  it('forwards an empty list when the RPC returns no rows', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const { data, error } = await getFriendFeed(['f1']);
    expect(data).toEqual([]);
    expect(error).toBeNull();
  });

  it('returns empty data and the error on RPC failure', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { data, error } = await getFriendFeed(['f1']);
    expect(data).toEqual([]);
    expect(error).toEqual({ message: 'boom' });
  });
});
