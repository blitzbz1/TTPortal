// Mock expo-sqlite before any imports
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

function createQueryChain(resolvedData: any = [], resolvedError: any = null) {
  const result = { data: resolvedData, error: resolvedError };
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    is: jest.fn(() => chain),
    gt: jest.fn(() => chain),
    order: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    range: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(result)),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

const mockFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

import { getActiveFriendCheckins } from '../checkins';

describe('getActiveFriendCheckins', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns empty array when no friend IDs provided', async () => {
    const { data, error } = await getActiveFriendCheckins([]);

    expect(data).toEqual([]);
    expect(error).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('queries checkins for given friend IDs with ended_at in the future', async () => {
    const checkins = [
      { user_id: 'f-1', venue_id: 44, started_at: '2026-03-27T15:00:00Z', venues: { name: 'Kiris Hall', city: 'București' } },
    ];
    mockFrom.mockReturnValue(createQueryChain(checkins));

    const { data } = await getActiveFriendCheckins(['f-1', 'f-2']);

    expect(mockFrom).toHaveBeenCalledWith('checkins');
    const chain = mockFrom.mock.results[0].value;
    expect(chain.select).toHaveBeenCalledWith('user_id, venue_id, started_at, venues(name, city)');
    expect(chain.in).toHaveBeenCalledWith('user_id', ['f-1', 'f-2']);
    expect(chain.gt).toHaveBeenCalledWith('ended_at', expect.any(String));
    expect(data).toHaveLength(1);
    expect((data![0] as any).venues.name).toBe('Kiris Hall');
  });

  it('returns multiple checkins from different friends at different venues', async () => {
    const checkins = [
      { user_id: 'f-1', venue_id: 44, started_at: '2026-03-27T15:00:00Z', venues: { name: 'Kiris Hall', city: 'București' } },
      { user_id: 'f-2', venue_id: 1, started_at: '2026-03-27T14:30:00Z', venues: { name: 'Parcul Național', city: 'București' } },
    ];
    mockFrom.mockReturnValue(createQueryChain(checkins));

    const { data } = await getActiveFriendCheckins(['f-1', 'f-2']);

    expect(data).toHaveLength(2);
    const venueNames = (data as any[]).map((c) => c.venues.name);
    expect(venueNames).toContain('Kiris Hall');
    expect(venueNames).toContain('Parcul Național');
  });

  it('returns empty when no friends have active checkins', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    const { data } = await getActiveFriendCheckins(['f-1']);

    expect(data).toEqual([]);
  });
});
