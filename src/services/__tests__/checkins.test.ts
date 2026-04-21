// Mock expo-sqlite before any imports
import {
  checkin,
  getActiveCheckins,
  getActiveFriendCheckins,
  getUserActiveCheckin,
  getUserAnyActiveCheckin,
} from '../checkins';

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
    not: jest.fn(() => chain),
    or: jest.fn(() => chain),
    gt: jest.fn(() => chain),
    order: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    range: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(result)),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

const mockFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

beforeEach(() => jest.clearAllMocks());

describe('checkin', () => {
  it('uses provided ended_at when given', async () => {
    const chain = createQueryChain({ id: 1 });
    mockFrom.mockReturnValue(chain);

    await checkin({
      user_id: 'u-1',
      venue_id: 10,
      table_number: null,
      started_at: '2026-03-30T14:00:00.000Z',
      ended_at: '2026-03-30T16:00:00.000Z',
      friends: null,
    });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ ended_at: '2026-03-30T16:00:00.000Z' })
    );
  });

  it('defaults ended_at to end of start day when not provided', async () => {
    const chain = createQueryChain({ id: 2 });
    mockFrom.mockReturnValue(chain);

    await checkin({
      user_id: 'u-1',
      venue_id: 10,
      table_number: null,
      started_at: '2026-03-30T14:00:00.000Z',
      ended_at: null,
      friends: null,
    });

    const insertArg = chain.insert.mock.calls[0][0];
    expect(insertArg.ended_at).toBeDefined();
    // Should be 23:59:59 on the same day
    const endDate = new Date(insertArg.ended_at);
    expect(endDate.getUTCDate()).toBe(30);
    expect(endDate.getHours()).toBe(23);
    expect(endDate.getMinutes()).toBe(59);
    expect(endDate.getSeconds()).toBe(59);
  });

  it('defaults ended_at when ended_at is undefined', async () => {
    const chain = createQueryChain({ id: 3 });
    mockFrom.mockReturnValue(chain);

    await checkin({
      user_id: 'u-1',
      venue_id: 10,
      table_number: null,
      started_at: '2026-04-15T09:00:00.000Z',
      ended_at: null,
      friends: null,
    });

    const insertArg = chain.insert.mock.calls[0][0];
    const endDate = new Date(insertArg.ended_at);
    expect(endDate.getHours()).toBe(23);
    expect(endDate.getMinutes()).toBe(59);
  });
});

describe('getActiveCheckins', () => {
  it('uses or filter for active checkins at a venue', async () => {
    const checkins = [
      { id: 1, user_id: 'u-1', venue_id: 5, started_at: '2026-03-30T14:00:00Z', ended_at: '2026-03-30T16:00:00Z' },
    ];
    mockFrom.mockReturnValue(createQueryChain(checkins));

    const { data } = await getActiveCheckins(5);

    expect(mockFrom).toHaveBeenCalledWith('checkins');
    const chain = mockFrom.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith('venue_id', 5);
    expect(chain.or).toHaveBeenCalledWith(expect.stringContaining('ended_at.gt.'));
    expect(chain.or).toHaveBeenCalledWith(expect.stringContaining('ended_at.is.null'));
    expect(data).toHaveLength(1);
  });
});

describe('getActiveFriendCheckins', () => {
  it('returns empty array when no friend IDs provided', async () => {
    const { data, error } = await getActiveFriendCheckins([]);

    expect(data).toEqual([]);
    expect(error).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('queries checkins with or filter for active state and resolves profile names', async () => {
    const checkins = [
      { id: 1, user_id: 'f-1', venue_id: 44, started_at: '2026-03-27T15:00:00Z', ended_at: null, venues: { name: 'Kiris Hall', city: 'București' } },
    ];
    const profiles = [{ id: 'f-1', full_name: 'Ion Popescu' }];
    const checkinsChain = createQueryChain(checkins);
    const profilesChain = createQueryChain(profiles);
    mockFrom.mockImplementation((table: string) => (table === 'profiles' ? profilesChain : checkinsChain));

    const { data } = await getActiveFriendCheckins(['f-1', 'f-2']);

    expect(mockFrom).toHaveBeenCalledWith('checkins');
    expect(checkinsChain.select).toHaveBeenCalledWith('id, user_id, venue_id, started_at, ended_at, venues(name, city)');
    expect(checkinsChain.in).toHaveBeenCalledWith('user_id', ['f-1', 'f-2']);
    expect(checkinsChain.or).toHaveBeenCalledWith(expect.stringContaining('ended_at.gt.'));
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(profilesChain.select).toHaveBeenCalledWith('id, full_name');
    expect(profilesChain.in).toHaveBeenCalledWith('id', ['f-1']);
    expect(data).toHaveLength(1);
    expect((data![0] as any).venues.name).toBe('Kiris Hall');
    expect((data![0] as any).profiles.full_name).toBe('Ion Popescu');
  });

  it('returns multiple checkins with profile names merged by user_id', async () => {
    const checkins = [
      { id: 1, user_id: 'f-1', venue_id: 44, started_at: '2026-03-27T15:00:00Z', ended_at: null, venues: { name: 'Kiris Hall', city: 'București' } },
      { id: 2, user_id: 'f-2', venue_id: 1, started_at: '2026-03-27T14:30:00Z', ended_at: null, venues: { name: 'Parcul Național', city: 'București' } },
    ];
    const profiles = [
      { id: 'f-1', full_name: 'Ion' },
      { id: 'f-2', full_name: 'Maria' },
    ];
    const checkinsChain = createQueryChain(checkins);
    const profilesChain = createQueryChain(profiles);
    mockFrom.mockImplementation((table: string) => (table === 'profiles' ? profilesChain : checkinsChain));

    const { data } = await getActiveFriendCheckins(['f-1', 'f-2']);

    expect(data).toHaveLength(2);
    const byId = (data as any[]).reduce<Record<string, any>>((m, c) => { m[c.user_id] = c; return m; }, {});
    expect(byId['f-1'].profiles.full_name).toBe('Ion');
    expect(byId['f-2'].profiles.full_name).toBe('Maria');
  });

  it('falls back to null full_name when no profile row is found', async () => {
    const checkins = [
      { id: 1, user_id: 'f-ghost', venue_id: 44, started_at: '2026-03-27T15:00:00Z', ended_at: null, venues: { name: 'X', city: 'București' } },
    ];
    const checkinsChain = createQueryChain(checkins);
    const profilesChain = createQueryChain([]);
    mockFrom.mockImplementation((table: string) => (table === 'profiles' ? profilesChain : checkinsChain));

    const { data } = await getActiveFriendCheckins(['f-ghost']);
    expect((data![0] as any).profiles.full_name).toBeNull();
  });

  it('returns empty when no friends have active checkins (no profiles query)', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    const { data } = await getActiveFriendCheckins(['f-1']);

    expect(data).toEqual([]);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('checkins');
  });
});

describe('getUserActiveCheckin', () => {
  it('queries by user and venue with or filter', async () => {
    const chain = createQueryChain([{ id: 10, ended_at: '2026-03-30T18:00:00Z' }]);
    mockFrom.mockReturnValue(chain);

    const { data } = await getUserActiveCheckin('u-1', 5);

    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u-1');
    expect(chain.eq).toHaveBeenCalledWith('venue_id', 5);
    expect(chain.or).toHaveBeenCalledWith(expect.stringContaining('ended_at.gt.'));
    expect(chain.limit).toHaveBeenCalledWith(1);
    expect(data).toEqual({ id: 10, ended_at: '2026-03-30T18:00:00Z' });
  });

  it('returns null when no active checkin exists', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    const { data } = await getUserActiveCheckin('u-1', 5);

    expect(data).toBeNull();
  });
});

describe('getUserAnyActiveCheckin', () => {
  it('queries by user with or filter', async () => {
    const chain = createQueryChain([{ id: 20, venue_id: 3, venues: { name: 'Sala X' } }]);
    mockFrom.mockReturnValue(chain);

    const { data } = await getUserAnyActiveCheckin('u-1');

    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u-1');
    expect(chain.or).toHaveBeenCalledWith(expect.stringContaining('ended_at.gt.'));
    expect(chain.or).toHaveBeenCalledWith(expect.stringContaining('ended_at.is.null'));
    expect(data).toEqual({ id: 20, venue_id: 3, venues: { name: 'Sala X' } });
  });

  it('returns null when no active checkin exists', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    const { data } = await getUserAnyActiveCheckin('u-1');

    expect(data).toBeNull();
  });
});

describe('activeFilter format', () => {
  it('includes both ended_at.gt and ended_at.is.null conditions', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    await getActiveCheckins(1);

    const chain = mockFrom.mock.results[0].value;
    const filterArg = chain.or.mock.calls[0][0];
    expect(filterArg).toMatch(/^ended_at\.gt\.\d{4}-\d{2}-\d{2}T/);
    expect(filterArg).toContain('and(ended_at.is.null,started_at.gte.');
  });
});
