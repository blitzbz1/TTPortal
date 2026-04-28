import {
  searchVenuesAdmin,
  updateVenue,
  deleteVenue,
  getUserFeedback,
  deleteUserFeedback,
  getFeedbackReplies,
  replyToFeedback,
} from '../admin';

function createQueryChain(resolvedData: any = [], resolvedError: any = null) {
  const result = { data: resolvedData, error: resolvedError };
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    or: jest.fn(() => chain),
    in: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(result)),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

const mockFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

beforeEach(() => jest.clearAllMocks());

describe('searchVenuesAdmin', () => {
  it('searches venues by name or address with ilike pattern', async () => {
    const venues = [{ id: 1, name: 'Parc Tineretului', address: 'Str. Principala' }];
    const chain = createQueryChain(venues);
    mockFrom.mockReturnValue(chain);

    const { data } = await searchVenuesAdmin('Parc');

    expect(mockFrom).toHaveBeenCalledWith('venues');
    expect(chain.select).toHaveBeenCalledWith('id, name, city, address, type, tables_count, lat, lng, description, approved');
    expect(chain.or).toHaveBeenCalledWith('name.ilike.%Parc%,address.ilike.%Parc%');
    expect(chain.order).toHaveBeenCalledWith('name');
    expect(chain.limit).toHaveBeenCalledWith(30);
    expect(data).toEqual(venues);
  });

  it('returns empty array when no matches', async () => {
    const chain = createQueryChain([]);
    mockFrom.mockReturnValue(chain);

    const { data } = await searchVenuesAdmin('nonexistent');

    expect(data).toEqual([]);
  });
});

describe('updateVenue', () => {
  it('returns unauthorized when user is not admin', async () => {
    // verifyAdmin calls profiles.select.eq.single — return is_admin: false
    const profilesChain = createQueryChain({ is_admin: false });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesChain;
      return createQueryChain();
    });

    const result = await updateVenue(1, 'user-1', { name: 'New Name' });

    expect(result).toEqual({ data: null, error: { message: 'Unauthorized' } });
  });

  it('updates venue when user is admin', async () => {
    const updated = { id: 1, name: 'New Name', city: 'București' };
    const profilesChain = createQueryChain({ is_admin: true });
    const venuesChain = createQueryChain(updated);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesChain;
      if (table === 'venues') return venuesChain;
      return createQueryChain();
    });

    const { data } = await updateVenue(1, 'admin-1', { name: 'New Name' });

    expect(mockFrom).toHaveBeenCalledWith('venues');
    expect(venuesChain.update).toHaveBeenCalledWith({ name: 'New Name' });
    expect(venuesChain.eq).toHaveBeenCalledWith('id', 1);
    expect(data).toEqual(updated);
  });

  it('forwards city_id when the city changes', async () => {
    const profilesChain = createQueryChain({ is_admin: true });
    const venuesChain = createQueryChain({ id: 1 });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesChain;
      if (table === 'venues') return venuesChain;
      return createQueryChain();
    });

    await updateVenue(1, 'admin-1', { city: 'Cluj', city_id: 42 });

    expect(venuesChain.update).toHaveBeenCalledWith({ city: 'Cluj', city_id: 42 });
  });

  it('forwards lat/lng when included in the update', async () => {
    const profilesChain = createQueryChain({ is_admin: true });
    const venuesChain = createQueryChain({ id: 1 });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesChain;
      if (table === 'venues') return venuesChain;
      return createQueryChain();
    });

    await updateVenue(1, 'admin-1', {
      address: 'Strada X 12',
      city: 'Cluj',
      lat: 46.77,
      lng: 23.6,
    });

    expect(venuesChain.update).toHaveBeenCalledWith({
      address: 'Strada X 12',
      city: 'Cluj',
      lat: 46.77,
      lng: 23.6,
    });
  });
});

describe('deleteVenue', () => {
  it('returns unauthorized when user is not admin', async () => {
    const profilesChain = createQueryChain({ is_admin: false });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesChain;
      return createQueryChain();
    });

    const result = await deleteVenue(1, 'user-1');

    expect(result).toEqual({ data: null, error: { message: 'Unauthorized' } });
  });

  it('deletes venue when user is admin', async () => {
    const profilesChain = createQueryChain({ is_admin: true });
    const venuesChain = createQueryChain(null);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesChain;
      if (table === 'venues') return venuesChain;
      return createQueryChain();
    });

    await deleteVenue(5, 'admin-1');

    expect(venuesChain.delete).toHaveBeenCalled();
    expect(venuesChain.eq).toHaveBeenCalledWith('id', 5);
  });
});

describe('getUserFeedback', () => {
  it('selects user_feedback then attaches profiles in a follow-up query', async () => {
    // Profile embed via `profiles!user_id(...)` is broken in this schema
    // (FK lands on auth.users), so the service fetches profiles separately
    // and merges them onto each row under the `profiles` key.
    const rows = [
      { id: 'f-1', user_id: 'u-1', category: 'bug', message: 'boom' },
    ];
    const profiles = [{ id: 'u-1', full_name: 'Alex', email: 'a@x.com' }];
    const feedbackChain = createQueryChain(rows);
    const profilesChain = createQueryChain(profiles);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_feedback') return feedbackChain;
      if (table === 'profiles') return profilesChain;
      return createQueryChain();
    });

    const { data } = await getUserFeedback();

    expect(mockFrom).toHaveBeenCalledWith('user_feedback');
    expect(feedbackChain.select).toHaveBeenCalledWith(
      'id, user_id, page, category, message, created_at',
    );
    expect(feedbackChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(feedbackChain.limit).toHaveBeenCalledWith(100);
    expect(profilesChain.select).toHaveBeenCalledWith('id, full_name, email');
    expect(profilesChain.in).toHaveBeenCalledWith('id', ['u-1']);
    expect(data).toEqual([
      { id: 'f-1', user_id: 'u-1', category: 'bug', message: 'boom', profiles: { id: 'u-1', full_name: 'Alex', email: 'a@x.com' } },
    ]);
  });

  it('honors custom limit', async () => {
    const chain = createQueryChain([]);
    mockFrom.mockReturnValue(chain);
    await getUserFeedback(25);
    expect(chain.limit).toHaveBeenCalledWith(25);
  });
});

describe('deleteUserFeedback', () => {
  it('returns unauthorized when user is not admin', async () => {
    const profilesChain = createQueryChain({ is_admin: false });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesChain;
      return createQueryChain();
    });

    const result = await deleteUserFeedback('f-1', 'user-1');

    expect(result).toEqual({ data: null, error: { message: 'Unauthorized' } });
  });

  it('deletes feedback row when user is admin', async () => {
    const profilesChain = createQueryChain({ is_admin: true });
    const feedbackChain = createQueryChain(null);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesChain;
      if (table === 'user_feedback') return feedbackChain;
      return createQueryChain();
    });

    await deleteUserFeedback('f-9', 'admin-1');

    expect(feedbackChain.delete).toHaveBeenCalled();
    expect(feedbackChain.eq).toHaveBeenCalledWith('id', 'f-9');
  });
});

describe('getFeedbackReplies', () => {
  it('fetches replies for a feedback ordered asc, then attaches admin profiles', async () => {
    // Same separated-fetch pattern as getUserFeedback — the FK on
    // feedback_replies.admin_id points to auth.users, not public.profiles.
    const rows = [
      { id: 'r-1', admin_id: 'a-1', reply_text: 'Working on it', created_at: '2026-04-20' },
    ];
    const profiles = [{ id: 'a-1', full_name: 'Admin' }];
    const repliesChain = createQueryChain(rows);
    const profilesChain = createQueryChain(profiles);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'feedback_replies') return repliesChain;
      if (table === 'profiles') return profilesChain;
      return createQueryChain();
    });

    const { data } = await getFeedbackReplies('f-1');

    expect(mockFrom).toHaveBeenCalledWith('feedback_replies');
    expect(repliesChain.select).toHaveBeenCalledWith(
      'id, feedback_id, admin_id, reply_text, created_at',
    );
    expect(repliesChain.eq).toHaveBeenCalledWith('feedback_id', 'f-1');
    expect(repliesChain.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(profilesChain.select).toHaveBeenCalledWith('id, full_name');
    expect(profilesChain.in).toHaveBeenCalledWith('id', ['a-1']);
    expect(data).toEqual([
      { id: 'r-1', admin_id: 'a-1', reply_text: 'Working on it', created_at: '2026-04-20', profiles: { id: 'a-1', full_name: 'Admin' } },
    ]);
  });
});

describe('replyToFeedback', () => {
  it('returns unauthorized when user is not admin', async () => {
    const profilesChain = createQueryChain({ is_admin: false });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesChain;
      return createQueryChain();
    });

    const result = await replyToFeedback('f-1', 'user-1', 'hi');

    expect(result).toEqual({ data: null, error: { message: 'Unauthorized' } });
  });

  it('rejects empty reply text', async () => {
    const profilesChain = createQueryChain({ is_admin: true });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesChain;
      return createQueryChain();
    });

    const { data, error } = await replyToFeedback('f-1', 'admin-1', '   ');
    expect(data).toBeNull();
    expect(error).toEqual({ message: 'Reply text is required' });
  });

  it('inserts trimmed reply when user is admin', async () => {
    const profilesChain = createQueryChain({ is_admin: true });
    const repliesChain = createQueryChain({ id: 'r-new' });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profilesChain;
      if (table === 'feedback_replies') return repliesChain;
      return createQueryChain();
    });

    const { data } = await replyToFeedback('f-1', 'admin-1', '   Fixed in v1.1   ');

    expect(mockFrom).toHaveBeenCalledWith('feedback_replies');
    expect(repliesChain.insert).toHaveBeenCalledWith({
      feedback_id: 'f-1',
      admin_id: 'admin-1',
      reply_text: 'Fixed in v1.1',
    });
    expect(repliesChain.single).toHaveBeenCalled();
    expect(data).toEqual({ id: 'r-new' });
  });
});
