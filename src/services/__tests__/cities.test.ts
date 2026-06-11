import { upsertCity } from '../cities';

const mockClearCitiesCache = jest.fn();
jest.mock('../../lib/citiesPersistentCache', () => ({
  clearCitiesCache: (...args: any[]) => mockClearCitiesCache(...args),
}));

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// `getCities` is gone — callers use the delta-synced useCitiesQuery
// hook now (see src/hooks/queries/useCitiesQuery.ts). Since migration 088
// the create path is a single find_or_create_city SECURITY DEFINER RPC —
// normalization/dedupe/repair happen server-side.

describe('upsertCity', () => {
  it('calls find_or_create_city with normalized inputs and returns the id', async () => {
    mockRpc.mockResolvedValue({ data: 42, error: null });

    const result = await upsertCity('  București ', {
      countryCode: 'ro',
      lat: 44.4268,
      lng: 26.1025,
      zoom: 11,
    });

    expect(result).toEqual({ id: 42, error: null });
    expect(mockRpc).toHaveBeenCalledWith('find_or_create_city', {
      p_name: 'București',
      p_country_code: 'RO',
      p_country_name: 'Romania',
      p_lat: 44.4268,
      p_lng: 26.1025,
      p_zoom: 11,
    });
    expect(mockClearCitiesCache).toHaveBeenCalled();
  });

  it('canonicalizes Piatra Neamț spelling variants', async () => {
    mockRpc.mockResolvedValue({ data: 7, error: null });

    await upsertCity('piatra neamt', { countryCode: 'RO', lat: 46.92, lng: 26.37 });

    expect(mockRpc).toHaveBeenCalledWith(
      'find_or_create_city',
      expect.objectContaining({ p_name: 'Piatra Neamț' }),
    );
  });

  it('defaults the country to the fallback when only a name is given', async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });

    await upsertCity('Cluj-Napoca');

    expect(mockRpc).toHaveBeenCalledWith(
      'find_or_create_city',
      expect.objectContaining({ p_country_code: 'RO' }),
    );
  });

  it('omits coordinates when no valid map center is provided', async () => {
    mockRpc.mockResolvedValue({ data: 9, error: null });

    await upsertCity('Wien', { countryCode: 'AT', lat: Number.NaN, lng: 16.37 });

    expect(mockRpc).toHaveBeenCalledWith(
      'find_or_create_city',
      expect.objectContaining({ p_lat: undefined, p_lng: undefined, p_zoom: undefined }),
    );
  });

  it('surfaces RPC errors (e.g. city_map_center_required) without clearing the cache', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'city_map_center_required' } });

    const result = await upsertCity('Neustadt', { countryCode: 'DE' });

    expect(result).toEqual({ id: null, error: 'city_map_center_required' });
    expect(mockClearCitiesCache).not.toHaveBeenCalled();
  });

  it('returns an error when the RPC yields no id', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const result = await upsertCity('Wien', { countryCode: 'AT', lat: 48.2, lng: 16.37 });

    expect(result).toEqual({ id: null, error: 'city_upsert_failed' });
  });
});
