// Mock expo-sqlite before any imports
import { getEventById, getEventParticipants, getEvents, sendEventInvites, sendEventUpdate, stopRecurrence } from '../events';

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
    or: jest.fn(() => chain),
    neq: jest.fn(() => chain),
    not: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    range: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(result)),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    returns: jest.fn(() => chain),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

const mockFrom = jest.fn();
const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

describe('getEventParticipants', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns participants with embedded profiles via FK', async () => {
    const profileA = { id: 'u-1', full_name: 'Andrei P.', avatar_url: null, city: 'București' };
    const profileB = { id: 'u-2', full_name: 'Maria I.', avatar_url: null, city: 'București' };
    const participants = [
      { user_id: 'u-1', joined_at: '2026-03-25T10:00:00Z', profiles: profileA },
      { user_id: 'u-2', joined_at: '2026-03-25T11:00:00Z', profiles: profileB },
    ];
    const chain = createQueryChain(participants);
    mockFrom.mockReturnValue(chain);

    const { data, error } = await getEventParticipants(4);

    expect(error).toBeNull();
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('event_participants');
    const selectArg = chain.select.mock.calls[0][0];
    expect(selectArg).toContain('profiles!event_participants_user_profiles_fk');
    expect(data).toHaveLength(2);
    expect((data![0] as any).profiles).toEqual(profileA);
    expect((data![1] as any).profiles).toEqual(profileB);
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

  it('passes through null profiles when the embed has no match', async () => {
    const participants = [
      { user_id: 'u-1', joined_at: '2026-03-25T10:00:00Z', profiles: null },
    ];
    mockFrom.mockReturnValue(createQueryChain(participants));

    const { data } = await getEventParticipants(1);

    expect(data).toHaveLength(1);
    expect((data![0] as any).profiles).toBeNull();
  });
});

describe('getEvents', () => {
  beforeEach(() => jest.clearAllMocks());

  it('filters upcoming events to "not yet ended" and excludes cancelled/completed', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    await getEvents('upcoming');

    const chain = mockFrom.mock.results[0].value;
    // Upcoming covers future + in-progress events via an OR over the time window.
    const orArg = chain.or.mock.calls[0][0] as string;
    expect(orArg).toContain('starts_at.gte.');
    expect(orArg).toContain('ends_at.gte.');
    expect(orArg).toContain('and(ends_at.is.null,starts_at.gte.');
    expect(chain.not).toHaveBeenCalledWith('status', 'in', '(cancelled,completed)');
    expect(chain.order).toHaveBeenCalledWith('starts_at', { ascending: true });
  });

  it('filters past events to "ended" and user participation', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    await getEvents('past', 'user-1');

    const chain = mockFrom.mock.results[0].value;
    const orArg = chain.or.mock.calls[0][0] as string;
    expect(orArg).toContain('ends_at.lt.');
    expect(orArg).toContain('and(ends_at.is.null,starts_at.lt.');
    expect(chain.eq).toHaveBeenCalledWith('ep_filter.user_id', 'user-1');
    expect(chain.order).toHaveBeenCalledWith('starts_at', { ascending: false });
  });

  it('filters mine events by organizer_id', async () => {
    mockFrom.mockReturnValue(createQueryChain([]));

    await getEvents('mine', 'user-1');

    const chain = mockFrom.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith('organizer_id', 'user-1');
  });
});

describe('sendEventInvites', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls rpc with send_event_invites and correct params', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await sendEventInvites(5, ['u-1', 'u-2'], 'org-1');

    expect(mockRpc).toHaveBeenCalledWith('send_event_invites', {
      p_event_id: 5,
      p_friend_ids: ['u-1', 'u-2'],
      p_organizer_id: 'org-1',
    });
  });

  it('returns error when rpc fails', async () => {
    const rpcError = { message: 'Not authorized' };
    mockRpc.mockResolvedValue({ data: null, error: rpcError });

    const { error } = await sendEventInvites(99, ['u-1'], 'org-1');

    expect(error).toEqual(rpcError);
  });
});

describe('sendEventUpdate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls rpc with send_event_update and correct params', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await sendEventUpdate(10, 'Se schimbă ora la 18:00', 'org-1');

    expect(mockRpc).toHaveBeenCalledWith('send_event_update', {
      p_event_id: 10,
      p_message: 'Se schimbă ora la 18:00',
      p_organizer_id: 'org-1',
    });
  });

  it('returns error when rpc fails', async () => {
    const rpcError = { message: 'Not authorized' };
    mockRpc.mockResolvedValue({ data: null, error: rpcError });

    const { error } = await sendEventUpdate(99, 'test', 'org-1');

    expect(error).toEqual(rpcError);
  });
});

describe('getEventById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('selects events with venue join and filters by id', async () => {
    const event = {
      id: 42,
      title: 'Pickup match',
      starts_at: '2026-04-01T18:00:00Z',
      venues: { name: 'Arena X', city: 'Bucharest', lat: 44.4, lng: 26.1 },
      event_participants: [],
    };
    const chain = createQueryChain(event);
    mockFrom.mockReturnValue(chain);

    const { data } = await getEventById(42);

    expect(mockFrom).toHaveBeenCalledWith('events');
    expect(chain.select).toHaveBeenCalledWith(
      '*, venues(name, city, lat, lng), event_participants(user_id, hours_played)',
    );
    expect(chain.eq).toHaveBeenCalledWith('id', 42);
    expect(chain.maybeSingle).toHaveBeenCalled();
    expect(data).toEqual(event);
  });

  it('returns null data when event does not exist', async () => {
    const chain = createQueryChain(null);
    mockFrom.mockReturnValue(chain);

    const { data, error } = await getEventById(999);

    expect(data).toBeNull();
    expect(error).toBeNull();
  });

  it('propagates errors from supabase', async () => {
    const chain = createQueryChain(null, { message: 'forbidden' });
    mockFrom.mockReturnValue(chain);

    const { error } = await getEventById(1);

    expect(error).toEqual({ message: 'forbidden' });
  });
});

describe('stopRecurrence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates recurrence fields to null', async () => {
    const chain = createQueryChain({ id: 5 });
    mockFrom.mockReturnValue(chain);

    await stopRecurrence(5, 'org-1');

    expect(mockFrom).toHaveBeenCalledWith('events');
    expect(chain.update).toHaveBeenCalledWith({ recurrence_rule: null, recurrence_day: null });
    expect(chain.eq).toHaveBeenCalledWith('id', 5);
  });

  it('returns error on failure', async () => {
    const chain = createQueryChain(null, { message: 'fail' });
    mockFrom.mockReturnValue(chain);

    const { error } = await stopRecurrence(99, 'org-1');

    expect(error).toEqual({ message: 'fail' });
  });
});
