// Mock expo-sqlite before any imports
import { getFriends, getPendingRequests } from '../friends';

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

// Chainable query builder mock
function createQueryChain(resolvedData: any = [], resolvedError: any = null) {
  const result = { data: resolvedData, error: resolvedError };
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    or: jest.fn(() => chain),
    in: jest.fn(() => chain),
    order: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(result)),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

const mockFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

describe('getFriends', () => {
  beforeEach(() => jest.clearAllMocks());

  const userId = 'user-1';
  const friendships = [
    { requester_id: 'user-1', addressee_id: 'user-2', status: 'accepted' },
    { requester_id: 'user-3', addressee_id: 'user-1', status: 'accepted' },
  ];
  const profiles = [
    { id: 'user-2', full_name: 'Maria Ionescu', avatar_url: null, city: 'București', username: 'maria' },
    { id: 'user-3', full_name: 'Cristian D.', avatar_url: null, city: 'Cluj', username: 'cristi' },
  ];

  it('returns friends with merged profile data', async () => {
    // First call: friendships query
    const friendshipsChain = createQueryChain(friendships);
    // Second call: profiles query
    const profilesChain = createQueryChain(profiles);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'friendships') return friendshipsChain;
      if (table === 'profiles') return profilesChain;
      return createQueryChain();
    });

    const { data, error } = await getFriends(userId);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data![0].requester).toBeNull(); // user-1 is self, excluded from profile fetch
    expect(data![0].addressee).toEqual(profiles[0]); // user-2 = Maria
    expect(data![1].requester).toEqual(profiles[1]); // user-3 = Cristian
  });

  it('returns empty array when user has no friends', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    const { data } = await getFriends(userId);

    expect(data).toEqual([]);
  });

  it('returns error from friendships query', async () => {
    const err = { message: 'RLS error' };
    mockFrom.mockReturnValue(createQueryChain(null, err));

    const { data, error } = await getFriends(userId);

    expect(error).toEqual(err);
    expect(data).toEqual([]);
  });

  it('queries friendships table with correct filters', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    await getFriends(userId);

    expect(mockFrom).toHaveBeenCalledWith('friendships');
    const chain = mockFrom.mock.results[0].value;
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.eq).toHaveBeenCalledWith('status', 'accepted');
    expect(chain.or).toHaveBeenCalledWith(
      `requester_id.eq.${userId},addressee_id.eq.${userId}`,
    );
  });

  it('fetches profiles only for friend IDs, excluding self', async () => {
    const friendshipsChain = createQueryChain(friendships);
    const profilesChain = createQueryChain(profiles);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'friendships') return friendshipsChain;
      if (table === 'profiles') return profilesChain;
      return createQueryChain();
    });

    await getFriends(userId);

    // profiles query should be called with friend IDs only (not self)
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    const profChain = mockFrom.mock.results[1].value;
    expect(profChain.in).toHaveBeenCalled();
    const inArgs = profChain.in.mock.calls[0];
    expect(inArgs[0]).toBe('id');
    expect(inArgs[1]).toContain('user-2');
    expect(inArgs[1]).toContain('user-3');
    expect(inArgs[1]).not.toContain('user-1');
  });
});

describe('getPendingRequests', () => {
  beforeEach(() => jest.clearAllMocks());

  const userId = 'user-1';

  it('returns pending requests with requester profiles', async () => {
    const pending = [
      { id: 10, requester_id: 'user-5', addressee_id: userId, status: 'pending' },
    ];
    const profiles = [
      { id: 'user-5', full_name: 'Diana P.', avatar_url: null },
    ];

    const pendingChain = createQueryChain(pending);
    const profilesChain = createQueryChain(profiles);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'friendships') return pendingChain;
      if (table === 'profiles') return profilesChain;
      return createQueryChain();
    });

    const { data, error } = await getPendingRequests(userId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].requester).toEqual(profiles[0]);
  });

  it('returns empty when no pending requests', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    const { data } = await getPendingRequests(userId);

    expect(data).toEqual([]);
  });
});
