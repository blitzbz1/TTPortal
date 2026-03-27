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
    gte: jest.fn(() => chain),
    lt: jest.fn(() => chain),
    neq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(result)),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

const mockFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

import { getEventParticipants, getEvents } from '../events';

describe('getEventParticipants', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns participants with merged profiles', async () => {
    const participants = [
      { user_id: 'u-1', joined_at: '2026-03-25T10:00:00Z' },
      { user_id: 'u-2', joined_at: '2026-03-25T11:00:00Z' },
    ];
    const profiles = [
      { id: 'u-1', full_name: 'Andrei P.', avatar_url: null, city: 'București' },
      { id: 'u-2', full_name: 'Maria I.', avatar_url: null, city: 'București' },
    ];

    const participantsChain = createQueryChain(participants);
    const profilesChain = createQueryChain(profiles);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'event_participants') return participantsChain;
      if (table === 'profiles') return profilesChain;
      return createQueryChain();
    });

    const { data, error } = await getEventParticipants(4);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect((data![0] as any).profiles).toEqual(profiles[0]);
    expect((data![1] as any).profiles).toEqual(profiles[1]);
    expect(data![0].user_id).toBe('u-1');
  });

  it('returns empty when event has no participants', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    const { data } = await getEventParticipants(999);

    expect(data).toEqual([]);
  });

  it('queries event_participants with correct event_id', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    await getEventParticipants(7);

    expect(mockFrom).toHaveBeenCalledWith('event_participants');
    const chain = mockFrom.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith('event_id', 7);
  });

  it('handles missing profiles gracefully', async () => {
    const participants = [
      { user_id: 'u-1', joined_at: '2026-03-25T10:00:00Z' },
    ];

    const participantsChain = createQueryChain(participants);
    const profilesChain = createQueryChain([]); // no profiles found
    mockFrom.mockImplementation((table: string) => {
      if (table === 'event_participants') return participantsChain;
      if (table === 'profiles') return profilesChain;
      return createQueryChain();
    });

    const { data } = await getEventParticipants(1);

    expect(data).toHaveLength(1);
    expect((data![0] as any).profiles).toBeNull();
  });
});

describe('getEvents', () => {
  beforeEach(() => jest.clearAllMocks());

  it('filters upcoming events by starts_at >= now and excludes cancelled', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    await getEvents('upcoming');

    const chain = mockFrom.mock.results[0].value;
    expect(chain.gte).toHaveBeenCalledWith('starts_at', expect.any(String));
    expect(chain.neq).toHaveBeenCalledWith('status', 'cancelled');
    expect(chain.order).toHaveBeenCalledWith('starts_at', { ascending: true });
  });

  it('filters past events by starts_at < now and user participation', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    await getEvents('past', 'user-1');

    const chain = mockFrom.mock.results[0].value;
    expect(chain.lt).toHaveBeenCalledWith('starts_at', expect.any(String));
    expect(chain.eq).toHaveBeenCalledWith('event_participants.user_id', 'user-1');
    expect(chain.order).toHaveBeenCalledWith('starts_at', { ascending: false });
  });

  it('filters mine events by organizer_id', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    await getEvents('mine', 'user-1');

    const chain = mockFrom.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith('organizer_id', 'user-1');
  });
});
