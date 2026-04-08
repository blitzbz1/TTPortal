jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

function createQueryChain(resolvedData: any = [], resolvedError: any = null) {
  const result = { data: resolvedData, error: resolvedError, count: null as number | null };
  const chain: any = {
    select: jest.fn((_sel?: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.count === 'exact') {
        // For count queries, the count comes from the response
        return chain;
      }
      return chain;
    }),
    eq: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    single: jest.fn(() => Promise.resolve(result)),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  // Allow setting count externally
  chain._setCount = (c: number) => { result.count = c; };
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
    const eventsChain = createQueryChain(null);
    // Simulate count response
    const eventsResult = { data: null, error: null, count: 5 };
    eventsChain.eq = jest.fn(() => ({
      ...eventsChain,
      then: (resolve: any) => Promise.resolve(eventsResult).then(resolve),
    }));

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
    });
    expect(error).toBeNull();
  });

  it('queries correct tables with user ID', async () => {
    const checkinsChain = createQueryChain(null);
    const eventsChain = createQueryChain(null);
    eventsChain.eq = jest.fn(() => ({
      ...eventsChain,
      then: (resolve: any) => Promise.resolve({ data: null, error: null, count: 0 }).then(resolve),
    }));

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

  it('defaults to zero when no checkin data exists', async () => {
    const checkinsChain = createQueryChain(null);
    const eventsChain = createQueryChain(null);
    eventsChain.eq = jest.fn(() => ({
      ...eventsChain,
      then: (resolve: any) => Promise.resolve({ data: null, error: null, count: null }).then(resolve),
    }));

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
    });
  });

  it('reports error when checkins query fails', async () => {
    const checkinsChain = createQueryChain(null, { message: 'db error' });
    const eventsChain = createQueryChain(null);
    eventsChain.eq = jest.fn(() => ({
      ...eventsChain,
      then: (resolve: any) => Promise.resolve({ data: null, error: null, count: 0 }).then(resolve),
    }));

    mockFrom.mockImplementation((table: string) => {
      if (table === 'leaderboard_checkins') return checkinsChain;
      if (table === 'event_participants') return eventsChain;
      return createQueryChain();
    });

    const { error } = await getProfileStats('user-1');

    expect(error).toEqual({ message: 'db error' });
  });

  it('reports error when events query fails', async () => {
    const checkinsChain = createQueryChain({ total_checkins: 5, unique_venues: 3 });
    const eventsChain = createQueryChain(null);
    eventsChain.eq = jest.fn(() => ({
      ...eventsChain,
      then: (resolve: any) => Promise.resolve({ data: null, error: { message: 'events error' }, count: null }).then(resolve),
    }));

    mockFrom.mockImplementation((table: string) => {
      if (table === 'leaderboard_checkins') return checkinsChain;
      if (table === 'event_participants') return eventsChain;
      return createQueryChain();
    });

    const { error } = await getProfileStats('user-1');

    expect(error).toEqual({ message: 'events error' });
  });
});
