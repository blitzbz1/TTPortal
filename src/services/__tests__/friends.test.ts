import { findUserByUsername, getFriends, getFriendshipBetweenUsers, getPendingRequests } from '../friends';

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
    or: jest.fn(() => chain),
    in: jest.fn(() => chain),
    order: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
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
    { id: 'user-2', full_name: 'Maria Ionescu', avatar_url: null, city: 'Bucuresti', username: 'maria' },
    { id: 'user-3', full_name: 'Cristian D.', avatar_url: null, city: 'Cluj', username: 'cristi' },
  ];

  it('returns friends with merged profile data', async () => {
    const friendshipsChain = createQueryChain(friendships);
    const profilesChain = createQueryChain(profiles);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'friendships') return friendshipsChain;
      if (table === 'profiles') return profilesChain;
      return createQueryChain();
    });

    const { data, error } = await getFriends(userId);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data![0].requester).toBeNull();
    expect(data![0].addressee).toEqual(profiles[0]);
    expect(data![1].requester).toEqual(profiles[1]);
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
});

describe('findUserByUsername', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns early for short usernames', async () => {
    const result = await findUserByUsername('ab');

    expect(result).toEqual({ data: null, error: null });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('looks up an exact normalized username', async () => {
    const profile = { id: 'user-2', full_name: 'Maria', username: 'maria' };
    const profilesChain = createQueryChain(profile, null);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesChain;
      return createQueryChain();
    });

    await findUserByUsername('@Maria');

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(profilesChain.eq).toHaveBeenCalledWith('username', 'maria');
    expect(profilesChain.maybeSingle).toHaveBeenCalled();
  });
});

describe('getFriendshipBetweenUsers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queries both friendship directions', async () => {
    const friendshipsChain = createQueryChain({ id: 3, status: 'pending' });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'friendships') return friendshipsChain;
      return createQueryChain();
    });

    await getFriendshipBetweenUsers('user-1', 'user-2');

    expect(mockFrom).toHaveBeenCalledWith('friendships');
    expect(friendshipsChain.or).toHaveBeenCalledWith(
      'and(requester_id.eq.user-1,addressee_id.eq.user-2),and(requester_id.eq.user-2,addressee_id.eq.user-1)',
    );
    expect(friendshipsChain.maybeSingle).toHaveBeenCalled();
  });
});
