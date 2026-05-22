import { upsertCity } from '../cities';

function createQueryChain(resolvedData: any = [], resolvedError: any = null) {
  const result = { data: resolvedData, error: resolvedError };
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    upsert: jest.fn(() => chain),
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

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockReset();
});

// `getCities` is gone — callers use the delta-synced useCitiesQuery
// hook now (see src/hooks/queries/useCitiesQuery.ts). The hook itself
// has its own integration test in the React Query layer.

describe('upsertCity', () => {
  it('returns existing city id when name matches', async () => {
    const countryChain = createQueryChain({ code: 'RO' });
    const chain = createQueryChain({ id: 42 });
    mockFrom.mockReturnValueOnce(countryChain).mockReturnValueOnce(chain);

    const result = await upsertCity('București');

    expect(result).toEqual({ id: 42, error: null });
    expect(countryChain.select).toHaveBeenCalledWith('code');
    expect(chain.select).toHaveBeenCalledWith('id');
    expect(chain.eq).toHaveBeenCalledWith('name', 'București');
    expect(chain.maybeSingle).toHaveBeenCalled();
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it('requires a map center when creating a new city', async () => {
    const countryChain = createQueryChain({ code: 'RO' });
    const selectChain = createQueryChain(null);
    mockFrom.mockReturnValueOnce(countryChain).mockReturnValueOnce(selectChain);

    const result = await upsertCity('Sibiu');

    expect(result).toEqual({ id: null, error: 'city_map_center_required' });
    expect(selectChain.insert).not.toHaveBeenCalled();
  });

  it('canonicalizes Piatra Neamt variants before upsert', async () => {
    const countryChain = createQueryChain({ code: 'RO' });
    const selectChain = createQueryChain({ id: 100 });
    mockFrom.mockReturnValueOnce(countryChain).mockReturnValueOnce(selectChain);

    const result = await upsertCity('Piatra-Neamt');

    expect(result).toEqual({ id: 100, error: null });
    expect(selectChain.eq).toHaveBeenCalledWith('name', 'Piatra Neamț');
  });

  it('stores map center when creating a new city', async () => {
    const countryChain = createQueryChain({ code: 'FR' });
    const selectChain = createQueryChain(null);
    const insertChain = createQueryChain({ id: 101 });
    mockFrom.mockReturnValueOnce(countryChain).mockReturnValueOnce(selectChain).mockReturnValueOnce(insertChain);

    const result = await upsertCity('Paris', {
      countryCode: 'FR',
      lat: 48.8566,
      lng: 2.3522,
      zoom: 11,
    });

    expect(result).toEqual({ id: 101, error: null });
    expect(insertChain.insert).toHaveBeenCalledWith({
      name: 'Paris',
      country_code: 'FR',
      country_name: 'France',
      lat: 48.8566,
      lng: 2.3522,
      zoom: 11,
      active: true,
      expansion_status: 'active',
    });
  });

  it('preserves backend country name for dynamic countries', async () => {
    const countrySelectChain = createQueryChain(null);
    const countryInsertChain = createQueryChain(null);
    const selectChain = createQueryChain(null);
    const insertChain = createQueryChain({ id: 102 });
    mockFrom
      .mockReturnValueOnce(countrySelectChain)
      .mockReturnValueOnce(countryInsertChain)
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(insertChain);

    const result = await upsertCity('Amsterdam', {
      countryCode: 'NL',
      countryName: 'Netherlands',
      lat: 52.3676,
      lng: 4.9041,
      zoom: 12,
    });

    expect(result).toEqual({ id: 102, error: null });
    expect(countryInsertChain.insert).toHaveBeenCalledWith({
      code: 'NL',
      name: 'Netherlands',
      active: true,
    });
    expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      country_code: 'NL',
      country_name: 'Netherlands',
    }));
  });

  it('recovers when another browser inserts the city first', async () => {
    const countryChain = createQueryChain({ code: 'RO' });
    const selectChain = createQueryChain(null);
    const insertChain = createQueryChain(null, { code: '23505', message: 'duplicate key value' });
    const raceSelectChain = createQueryChain({ id: 123 });
    mockFrom
      .mockReturnValueOnce(countryChain)
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(raceSelectChain);

    const result = await upsertCity('Sibiu', { lat: 45.7983, lng: 24.1256, zoom: 12 });

    expect(result).toEqual({ id: 123, error: null });
    expect(raceSelectChain.eq).toHaveBeenCalledWith('name', 'Sibiu');
    expect(raceSelectChain.eq).toHaveBeenCalledWith('country_code', 'RO');
  });

  it('returns error when insert fails', async () => {
    const countryChain = createQueryChain({ code: 'RO' });
    const selectChain = createQueryChain(null);
    const insertChain = createQueryChain(null, { message: 'DB error' });
    mockFrom.mockReturnValueOnce(countryChain).mockReturnValueOnce(selectChain).mockReturnValueOnce(insertChain);

    const result = await upsertCity('Brașov', { lat: 45.6427, lng: 25.5887, zoom: 12 });

    expect(result).toEqual({ id: null, error: 'DB error' });
  });
});
