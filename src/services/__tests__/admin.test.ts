import {
  searchVenuesAdmin,
  updateVenue,
  deleteVenue,
} from '../admin';

function createQueryChain(resolvedData: any = [], resolvedError: any = null) {
  const result = { data: resolvedData, error: resolvedError };
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    or: jest.fn(() => chain),
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
