import {
  acceptRequest,
  declineRequest,
  findUserByUsername,
  getFriendIds,
  getFriends,
  getFriendshipBetweenUsers,
  getPendingRequests,
  sendRequest,
} from '../friends';

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
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    or: jest.fn(() => chain),
    in: jest.fn(() => chain),
    order: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    single: jest.fn(() => Promise.resolve(result)),
    returns: jest.fn(() => chain),
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
  const profile2 = { id: 'user-2', full_name: 'Maria Ionescu', avatar_url: null, city: 'București', username: 'maria' };
  const profile3 = { id: 'user-3', full_name: 'Cristian D.', avatar_url: null, city: 'Cluj', username: 'cristi' };
  // Embedded shape returned by PostgREST after migration 038.
  const friendshipsWithProfiles = [
    {
      id: 1,
      requester_id: 'user-1',
      addressee_id: 'user-2',
      status: 'accepted',
      created_at: '2025-01-01T00:00:00Z',
      requester: null,
      addressee: profile2,
    },
    {
      id: 2,
      requester_id: 'user-3',
      addressee_id: 'user-1',
      status: 'accepted',
      created_at: '2025-01-02T00:00:00Z',
      requester: profile3,
      addressee: null,
    },
  ];

  it('returns friends with embedded profile data', async () => {
    mockFrom.mockReturnValue(createQueryChain(friendshipsWithProfiles));

    const { data, error } = await getFriends(userId);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data![0].addressee).toEqual(profile2);
    expect(data![1].requester).toEqual(profile3);
  });

  it('returns empty array when user has no friends', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    const { data } = await getFriends(userId);

    expect(data).toEqual([]);
  });

  it('propagates error from friendships query', async () => {
    const err = { message: 'RLS error' };
    mockFrom.mockReturnValue(createQueryChain(null, err));

    const { error } = await getFriends(userId);

    expect(error).toEqual(err);
  });

  it('issues a single query against friendships with embedded profiles', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    await getFriends(userId);

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('friendships');
    const chain = mockFrom.mock.results[0].value;
    const selectArg = chain.select.mock.calls[0][0];
    expect(selectArg).toContain('requester:profiles!friendships_requester_profiles_fk');
    expect(selectArg).toContain('addressee:profiles!friendships_addressee_profiles_fk');
    expect(chain.eq).toHaveBeenCalledWith('status', 'accepted');
    expect(chain.or).toHaveBeenCalledWith(
      `requester_id.eq.${userId},addressee_id.eq.${userId}`,
    );
  });
});

describe('getPendingRequests', () => {
  beforeEach(() => jest.clearAllMocks());

  const userId = 'user-1';

  it('returns pending requests with requester profile embedded', async () => {
    const requesterProfile = { id: 'user-5', full_name: 'Diana P.', avatar_url: null };
    const pending = [
      {
        id: 10,
        requester_id: 'user-5',
        addressee_id: userId,
        status: 'pending',
        created_at: '2025-01-01T00:00:00Z',
        requester: requesterProfile,
      },
    ];
    mockFrom.mockReturnValue(createQueryChain(pending));

    const { data, error } = await getPendingRequests(userId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].requester).toEqual(requesterProfile);
    expect(mockFrom).toHaveBeenCalledTimes(1);
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

describe('sendRequest', () => {
  beforeEach(() => jest.clearAllMocks());

  it('inserts a pending friendship row', async () => {
    const chain = createQueryChain({ id: 9, status: 'pending' });
    mockFrom.mockReturnValue(chain);

    await sendRequest('user-1', 'user-2');

    expect(mockFrom).toHaveBeenCalledWith('friendships');
    expect(chain.insert).toHaveBeenCalledWith({
      requester_id: 'user-1',
      addressee_id: 'user-2',
      status: 'pending',
    });
    expect(chain.single).toHaveBeenCalled();
  });
});

describe('acceptRequest', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates status to accepted, scoped to addressee', async () => {
    const chain = createQueryChain({ id: 4, status: 'accepted' });
    mockFrom.mockReturnValue(chain);

    await acceptRequest(4, 'user-1');

    expect(chain.update).toHaveBeenCalledWith({ status: 'accepted' });
    expect(chain.eq).toHaveBeenCalledWith('id', 4);
    expect(chain.eq).toHaveBeenCalledWith('addressee_id', 'user-1');
    expect(chain.single).toHaveBeenCalled();
  });
});

describe('declineRequest', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates status to declined, scoped to addressee', async () => {
    const chain = createQueryChain({ id: 7, status: 'declined' });
    mockFrom.mockReturnValue(chain);

    await declineRequest(7, 'user-1');

    expect(chain.update).toHaveBeenCalledWith({ status: 'declined' });
    expect(chain.eq).toHaveBeenCalledWith('id', 7);
    expect(chain.eq).toHaveBeenCalledWith('addressee_id', 'user-1');
  });
});

describe('getFriendIds', () => {
  beforeEach(() => jest.clearAllMocks());

  const userId = 'user-1';

  it('returns the friend (non-self) side of each accepted friendship', async () => {
    const friendships = [
      { requester_id: 'user-1', addressee_id: 'user-2' },
      { requester_id: 'user-3', addressee_id: 'user-1' },
    ];
    mockFrom.mockReturnValue(createQueryChain(friendships));

    const ids = await getFriendIds(userId);

    expect(ids).toEqual(['user-2', 'user-3']);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('friendships');
    const chain = mockFrom.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith('status', 'accepted');
    expect(chain.or).toHaveBeenCalledWith(
      `requester_id.eq.${userId},addressee_id.eq.${userId}`,
    );
  });

  it('returns an empty array when there are no accepted friendships', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    const ids = await getFriendIds(userId);

    expect(ids).toEqual([]);
  });

  it('returns an empty array when supabase yields no data', async () => {
    mockFrom.mockReturnValue(createQueryChain(null));

    const ids = await getFriendIds(userId);

    expect(ids).toEqual([]);
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
