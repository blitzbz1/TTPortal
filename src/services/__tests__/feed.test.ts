jest.mock('../../lib/supabase', () => {
  const createChain = (resolvedValue: any) => {
    const chain: any = {};
    chain.select = jest.fn().mockReturnValue(chain);
    chain.in = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.limit = jest.fn().mockResolvedValue(resolvedValue);
    return chain;
  };

  const checkinData = {
    data: [
      {
        id: 1,
        user_id: 'f1',
        venue_id: 10,
        started_at: '2026-04-01T10:00:00Z',
        profiles: { full_name: 'Andrei' },
        venues: { name: 'ClubPing', city: 'Bucuresti' },
      },
    ],
    error: null,
  };

  const reviewData = {
    data: [
      {
        id: 2,
        user_id: 'f2',
        venue_id: 20,
        rating: 5,
        created_at: '2026-04-01T11:00:00Z',
        reviewer_name: 'Maria',
        venues: { name: 'Parc Tineretului' },
      },
    ],
    error: null,
  };

  let callCount = 0;
  const fromMock = jest.fn(() => {
    callCount++;
    // First call = checkins, second = reviews
    return createChain(callCount % 2 === 1 ? checkinData : reviewData);
  });

  return {
    supabase: { from: fromMock },
    __mocks: { fromMock },
  };
});

import { getFriendFeed } from '../feed';

beforeEach(() => jest.clearAllMocks());

describe('getFriendFeed', () => {
  it('returns empty array when no friend IDs provided', async () => {
    const result = await getFriendFeed([]);
    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('returns merged and sorted feed items from checkins and reviews', async () => {
    const result = await getFriendFeed(['f1', 'f2']);
    expect(result.data.length).toBe(2);

    // Review timestamp is later, so it should come first
    expect(result.data[0].type).toBe('review');
    expect(result.data[0].userName).toBe('Maria');
    expect(result.data[1].type).toBe('checkin');
    expect(result.data[1].userName).toBe('Andrei');
  });

  it('includes venue info in feed items', async () => {
    const result = await getFriendFeed(['f1']);
    const checkinItem = result.data.find((i) => i.type === 'checkin');
    expect(checkinItem?.venueName).toBe('ClubPing');
    expect(checkinItem?.venueCity).toBe('Bucuresti');
  });
});
