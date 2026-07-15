import { createQueryChain } from '../../test-utils/supabaseMock';
// Mock expo-sqlite before any imports
import {
  checkin,
  getVenueActiveCheckinCount,
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


const mockFrom = jest.fn();
const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    rpc: (...args: any[]) => mockRpc(...args),
  },
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

describe('getVenueActiveCheckinCount', () => {
  // Direct per-venue row reads were removed with the RLS scoping in
  // migration 084; anonymous-safe surfaces use the count-only RPC.
  it('calls the count RPC with the venue id', async () => {
    mockRpc.mockResolvedValue({ data: 3, error: null });

    const { data, error } = await getVenueActiveCheckinCount(5);

    expect(mockRpc).toHaveBeenCalledWith('get_venue_active_checkin_count', {
      p_venue_id: 5,
    });
    expect(data).toBe(3);
    expect(error).toBeNull();
  });

  it('returns 0 when the RPC yields no data', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const { data } = await getVenueActiveCheckinCount(5);
    expect(data).toBe(0);
  });
});

describe('getActiveFriendCheckins', () => {
  it('returns empty array when no friend IDs provided', async () => {
    const { data, error } = await getActiveFriendCheckins([]);

    expect(data).toEqual([]);
    expect(error).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('issues a single query with profiles embedded via FK', async () => {
    const checkins = [
      {
        id: 1,
        user_id: 'f-1',
        venue_id: 44,
        started_at: '2026-03-27T15:00:00Z',
        ended_at: null,
        venues: { name: 'Kiris Hall', city: 'București' },
        profiles: { full_name: 'Ion Popescu' },
      },
    ];
    const checkinsChain = createQueryChain(checkins);
    mockFrom.mockReturnValue(checkinsChain);

    const { data } = await getActiveFriendCheckins(['f-1', 'f-2']);

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('checkins');
    const selectArg = checkinsChain.select.mock.calls[0][0];
    expect(selectArg).toContain('profiles!checkins_user_profiles_fk(full_name)');
    expect(checkinsChain.in).toHaveBeenCalledWith('user_id', ['f-1', 'f-2']);
    expect(checkinsChain.or).toHaveBeenCalledWith(expect.stringContaining('ended_at.gt.'));
    expect(data).toHaveLength(1);
    expect((data![0] as any).venues.name).toBe('Kiris Hall');
    expect((data![0] as any).profiles.full_name).toBe('Ion Popescu');
  });

  it('returns multiple checkins with embedded profiles', async () => {
    const checkins = [
      { id: 1, user_id: 'f-1', venue_id: 44, started_at: '2026-03-27T15:00:00Z', ended_at: null, venues: { name: 'Kiris Hall', city: 'București' }, profiles: { full_name: 'Ion' } },
      { id: 2, user_id: 'f-2', venue_id: 1, started_at: '2026-03-27T14:30:00Z', ended_at: null, venues: { name: 'Parcul Național', city: 'București' }, profiles: { full_name: 'Maria' } },
    ];
    mockFrom.mockReturnValue(createQueryChain(checkins));

    const { data } = await getActiveFriendCheckins(['f-1', 'f-2']);

    expect(data).toHaveLength(2);
    const byId = (data as any[]).reduce<Record<string, any>>((m, c) => { m[c.user_id] = c; return m; }, {});
    expect(byId['f-1'].profiles.full_name).toBe('Ion');
    expect(byId['f-2'].profiles.full_name).toBe('Maria');
  });

  it('returns empty when no friends have active checkins', async () => {
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

    await getActiveFriendCheckins(['f-1']);

    const chain = mockFrom.mock.results[0].value;
    const filterArg = chain.or.mock.calls[0][0];
    expect(filterArg).toMatch(/^ended_at\.gt\.\d{4}-\d{2}-\d{2}T/);
    expect(filterArg).toContain('and(ended_at.is.null,started_at.gte.');
  });
});
