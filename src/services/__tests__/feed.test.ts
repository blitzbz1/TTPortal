import { getFriendFeed, getCrossedPaths, dismissCrossedPath } from '../feed';

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

beforeEach(() => jest.clearAllMocks());

describe('getFriendFeed', () => {
  // Implementation calls the get_friend_feed RPC (migrations 052/083),
  // which derives the caller's accepted friendships from auth.uid() and
  // does the UNION ALL + ORDER BY + LIMIT server-side. The client just
  // rehydrates the FeedItem shape.

  it('passes only the limit to the RPC (identity comes from auth.uid())', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await getFriendFeed(25);
    expect(mockRpc).toHaveBeenCalledWith('get_friend_feed', {
      p_limit: 25,
    });
  });

  it('defaults the limit to 30', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await getFriendFeed();
    expect(mockRpc).toHaveBeenCalledWith('get_friend_feed', {
      p_limit: 30,
    });
  });

  it('maps RPC rows to FeedItem shape', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          kind: 'review', id: 2, user_id: 'f2', user_name: 'Maria',
          venue_id: 20, venue_name: 'Parc Tineretului', venue_city: '',
          rating: 5, ts: '2026-04-01T11:00:00Z', photo_url: null,
        },
        {
          kind: 'checkin', id: 1, user_id: 'f1', user_name: 'Andrei',
          venue_id: 10, venue_name: 'ClubPing', venue_city: 'Bucuresti',
          rating: null, ts: '2026-04-01T10:00:00Z', photo_url: null,
        },
      ],
      error: null,
    });

    const { data } = await getFriendFeed();

    expect(data).toEqual([
      {
        id: 'review-2', type: 'review', userId: 'f2', userName: 'Maria',
        venueId: 20, venueName: 'Parc Tineretului', venueCity: undefined,
        rating: 5, timestamp: '2026-04-01T11:00:00Z', photoUrl: null,
      },
      {
        id: 'checkin-1', type: 'checkin', userId: 'f1', userName: 'Andrei',
        venueId: 10, venueName: 'ClubPing', venueCity: 'Bucuresti',
        rating: undefined, timestamp: '2026-04-01T10:00:00Z', photoUrl: null,
      },
    ]);
  });

  it('maps a moment row, carrying its photo_url (F042)', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          kind: 'moment', id: 9, user_id: 'f3', user_name: 'Ioana',
          venue_id: 30, venue_name: 'ClubPing', venue_city: 'Cluj',
          rating: null, ts: '2026-04-02T09:00:00Z', photo_url: 'https://cdn/m9.jpg',
        },
      ],
      error: null,
    });

    const { data } = await getFriendFeed();

    expect(data).toEqual([
      {
        id: 'moment-9', type: 'moment', userId: 'f3', userName: 'Ioana',
        venueId: 30, venueName: 'ClubPing', venueCity: 'Cluj',
        rating: undefined, timestamp: '2026-04-02T09:00:00Z', photoUrl: 'https://cdn/m9.jpg',
      },
    ]);
  });

  it('forwards an empty list when the RPC returns no rows', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const { data, error } = await getFriendFeed();
    expect(data).toEqual([]);
    expect(error).toBeNull();
  });

  it('returns empty data and the error on RPC failure', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { data, error } = await getFriendFeed();
    expect(data).toEqual([]);
    expect(error).toEqual({ message: 'boom' });
  });
});

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
