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


import { getProfileStats } from '../profiles';

describe('getProfileStats', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns checkins and events count', async () => {
    const checkinsChain = createQueryChain({ total_checkins: 15, unique_venues: 8 });
    const eventsChain = createQueryChain([
      { hours_played: 0 }, { hours_played: 0 }, { hours_played: 0 }, { hours_played: 0 }, { hours_played: 0 },
    ]);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'leaderboard_checkins') return checkinsChain;
      if (table === 'event_participants') return eventsChain;
      return createQueryChain();
    });

    const { data, error } = await getProfileStats('user-1');

    expect(data).toEqual({
      total_checkins: 15,
      unique_venues: 8,
      events_joined: 5,
      total_hours_played: 0,
    });
    expect(error).toBeNull();
  });

  it('queries correct tables with user ID', async () => {
    const checkinsChain = createQueryChain(null);
    const eventsChain = createQueryChain([]);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'leaderboard_checkins') return checkinsChain;
      if (table === 'event_participants') return eventsChain;
      return createQueryChain();
    });

    await getProfileStats('user-42');

    expect(mockFrom).toHaveBeenCalledWith('leaderboard_checkins');
    expect(mockFrom).toHaveBeenCalledWith('event_participants');
    expect(checkinsChain.eq).toHaveBeenCalledWith('user_id', 'user-42');
    expect(eventsChain.eq).toHaveBeenCalledWith('user_id', 'user-42');
  });

  it('defaults to zero when no checkin or event data exists', async () => {
    const checkinsChain = createQueryChain(null);
    const eventsChain = createQueryChain([]);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'leaderboard_checkins') return checkinsChain;
      if (table === 'event_participants') return eventsChain;
      return createQueryChain();
    });

    const { data } = await getProfileStats('user-1');

    expect(data).toEqual({
      total_checkins: 0,
      unique_venues: 0,
      events_joined: 0,
      total_hours_played: 0,
    });
  });

  it('reports error when checkins query fails', async () => {
    const checkinsChain = createQueryChain(null, { message: 'db error' });
    const eventsChain = createQueryChain([]);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'leaderboard_checkins') return checkinsChain;
      if (table === 'event_participants') return eventsChain;
      return createQueryChain();
    });

    const { error } = await getProfileStats('user-1');

    expect(error).toEqual({ message: 'db error' });
  });

  it('sums hours_played from event_participants', async () => {
    const checkinsChain = createQueryChain({ total_checkins: 3, unique_venues: 2 });
    const eventsChain = createQueryChain([
      { hours_played: 1.5 },
      { hours_played: 2 },
      { hours_played: 0.5 },
      { hours_played: 0 },
    ]);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'leaderboard_checkins') return checkinsChain;
      if (table === 'event_participants') return eventsChain;
      return createQueryChain();
    });

    const { data } = await getProfileStats('user-1');

    expect(data).toEqual({
      total_checkins: 3,
      unique_venues: 2,
      events_joined: 4,
      total_hours_played: 4,
    });
  });

  it('coerces non-numeric / null hours_played to zero', async () => {
    const checkinsChain = createQueryChain(null);
    const eventsChain = createQueryChain([
      { hours_played: null },
      { hours_played: 'oops' },
      { hours_played: 2 },
    ]);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'leaderboard_checkins') return checkinsChain;
      if (table === 'event_participants') return eventsChain;
      return createQueryChain();
    });

    const { data } = await getProfileStats('user-1');

    expect(data?.total_hours_played).toBe(2);
  });

  it('reports error when events query fails', async () => {
    const checkinsChain = createQueryChain({ total_checkins: 5, unique_venues: 3 });
    const eventsChain = createQueryChain(null, { message: 'events error' });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'leaderboard_checkins') return checkinsChain;
      if (table === 'event_participants') return eventsChain;
      return createQueryChain();
    });

    const { error } = await getProfileStats('user-1');

    expect(error).toEqual({ message: 'events error' });
  });
});
