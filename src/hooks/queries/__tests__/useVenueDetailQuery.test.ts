import { renderHook, waitFor } from '@testing-library/react-native';
import { useVenueDetailQuery } from '../useVenueDetailQuery';

const mockRpc = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: (...a: any[]) => mockRpc(...a) },
}));

const mockLoadMeta = jest.fn();
const mockLoadReviews = jest.fn();
const mockSaveMeta = jest.fn();
const mockSaveReviews = jest.fn();
jest.mock('../../../lib/venueDetailCache', () => ({
  loadCachedVenueMeta: (...a: any[]) => mockLoadMeta(...a),
  loadCachedVenueReviews: (...a: any[]) => mockLoadReviews(...a),
  saveCachedVenueMeta: (...a: any[]) => mockSaveMeta(...a),
  saveCachedVenueReviews: (...a: any[]) => mockSaveReviews(...a),
}));

const BUNDLE = {
  venue: { id: 7, name: 'Cache Venue' },
  stats: { venue_id: 7, avg_rating: 4 },
  is_favorited: true,
  user_active_checkin: null,
  upcoming_event_count: 2,
  champion: null,
  recent_reviews: [{ id: 1, rating: 4 }],
};

describe('useVenueDetailQuery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('mirrors a successful bundle into the venue-detail cache', async () => {
    mockRpc.mockResolvedValue({ data: BUNDLE, error: null });

    const { result } = renderHook(() => useVenueDetailQuery(7, 'u1'));

    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.data?.fromCache).toBeUndefined();
    expect(mockSaveMeta).toHaveBeenCalledWith(7, { venue: BUNDLE.venue, stats: BUNDLE.stats });
    expect(mockSaveReviews).toHaveBeenCalledWith(7, BUNDLE.recent_reviews);
  });

  it('falls back to the cache with fromCache=true when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'network' } });
    mockLoadMeta.mockReturnValue({ data: { venue: BUNDLE.venue, stats: BUNDLE.stats }, fresh: false });
    mockLoadReviews.mockReturnValue({ data: BUNDLE.recent_reviews, fresh: false });

    const { result } = renderHook(() => useVenueDetailQuery(7, 'u1'));

    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.data).toMatchObject({
      fromCache: true,
      venue: BUNDLE.venue,
      is_favorited: false,
      user_active_checkin: null,
      recent_reviews: BUNDLE.recent_reviews,
    });
  });

  it('surfaces the error when the RPC fails and nothing is cached', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'network' } });
    mockLoadMeta.mockReturnValue(null);

    const { result } = renderHook(() => useVenueDetailQuery(7, 'u1'));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('returns null (not an error) when the venue genuinely does not exist', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useVenueDetailQuery(7, 'u1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
    expect(mockSaveMeta).not.toHaveBeenCalled();
  });
});
