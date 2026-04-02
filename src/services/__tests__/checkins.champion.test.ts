import { getVenueChampion } from '../checkins';

jest.mock('../../lib/supabase', () => {
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockResolvedValue({
    data: [
      { user_id: 'u1', started_at: '2026-03-25T10:00:00Z', profiles: { full_name: 'Champion' } },
      { user_id: 'u1', started_at: '2026-03-26T10:00:00Z', profiles: { full_name: 'Champion' } },
      { user_id: 'u1', started_at: '2026-03-27T10:00:00Z', profiles: { full_name: 'Champion' } },
      { user_id: 'u2', started_at: '2026-03-25T10:00:00Z', profiles: { full_name: 'Runner Up' } },
    ],
    error: null,
  });

  return {
    supabase: { from: jest.fn(() => chain) },
  };
});

describe('getVenueChampion', () => {
  it('returns the user with the most unique check-in days', async () => {
    const result = await getVenueChampion(1);
    expect(result.data).not.toBeNull();
    expect(result.data!.userId).toBe('u1');
    expect(result.data!.fullName).toBe('Champion');
    expect(result.data!.dayCount).toBe(3);
  });
});
