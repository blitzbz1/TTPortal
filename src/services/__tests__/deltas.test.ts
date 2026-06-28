// T070: the three delta services are thin RPC wrappers — these tests pin
// the RPC names, the param mapping (null → undefined so server defaults
// apply), and error passthrough. The watermark advance/merge logic lives in
// the persistent caches and is covered by their own suites.
import { getVenuesDelta } from '../venuesDelta';
import { getCitiesDelta, searchCities, getCitiesByIds } from '../citiesDelta';
import { getEquipmentCatalogDelta } from '../equipmentDelta';

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

beforeEach(() => jest.clearAllMocks());

describe('getVenuesDelta', () => {
  it('passes the watermark and filters through to the RPC', async () => {
    const payload = { upserts: [{ id: 1 }], tombstone_ids: [2], synced_at: 't1' };
    mockRpc.mockResolvedValue({ data: payload, error: null });

    const { data, error } = await getVenuesDelta('2026-06-01T00:00:00Z', 'Wien', 'parc_exterior', 7);

    expect(mockRpc).toHaveBeenCalledWith('get_venues_delta', {
      p_since: '2026-06-01T00:00:00Z',
      p_city: 'Wien',
      p_type: 'parc_exterior',
      p_city_id: 7,
    });
    expect(data).toEqual(payload);
    expect(error).toBeNull();
  });

  it('omits null filters so the server defaults apply (cold sync)', async () => {
    mockRpc.mockResolvedValue({ data: { upserts: [], tombstone_ids: [], synced_at: 't' }, error: null });

    await getVenuesDelta(null);

    expect(mockRpc).toHaveBeenCalledWith('get_venues_delta', {
      p_since: undefined,
      p_city: undefined,
      p_type: undefined,
      p_city_id: undefined,
    });
  });

  it('propagates RPC errors with null data', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { data, error } = await getVenuesDelta('t');
    expect(data).toBeNull();
    expect(error).toEqual({ message: 'boom' });
  });
});

describe('getCitiesDelta (reverted to prod-deployed get_cities_delta)', () => {
  // get_cities_catalog_v2 (mig 139) is NOT on prod, so the client must keep
  // calling the deployed get_cities_delta until 139 ships.
  it('targets get_cities_delta and passes the watermark through', async () => {
    mockRpc.mockResolvedValue({ data: { upserts: [], tombstone_ids: [], synced_at: 't' }, error: null });
    await getCitiesDelta('2026-06-01T00:00:00Z');
    expect(mockRpc).toHaveBeenCalledWith('get_cities_delta', { p_since: '2026-06-01T00:00:00Z' });
  });

  it('omits a null watermark', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await getCitiesDelta(null);
    expect(mockRpc).toHaveBeenCalledWith('get_cities_delta', { p_since: undefined });
  });
});

describe('searchCities (Stage 2 — long-tail prefix search)', () => {
  it('maps query + limit to search_cities and returns the rows', async () => {
    const rows = [{ id: 5, name: 'Cluj-Napoca' }];
    mockRpc.mockResolvedValue({ data: rows, error: null });
    const { data } = await searchCities('cluj', 10);
    expect(mockRpc).toHaveBeenCalledWith('search_cities', { p_query: 'cluj', p_limit: 10 });
    expect(data).toEqual(rows);
  });

  it('defaults the limit and coerces null data to an empty array', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const { data } = await searchCities('cl');
    expect(mockRpc).toHaveBeenCalledWith('search_cities', { p_query: 'cl', p_limit: 20 });
    expect(data).toEqual([]);
  });
});

describe('getCitiesByIds (Stage 2 — single-row fallback)', () => {
  it('sends only positive ids (negative EXPANSION_CITY_WAVE ids are client-only)', async () => {
    mockRpc.mockResolvedValue({ data: [{ id: 5 }], error: null });
    await getCitiesByIds([-1001, 5, -3]);
    expect(mockRpc).toHaveBeenCalledWith('get_cities_by_ids', { p_ids: [5] });
  });

  it('skips the round-trip entirely when no positive ids remain', async () => {
    const { data, error } = await getCitiesByIds([-1001, -3]);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(data).toEqual([]);
    expect(error).toBeNull();
  });
});

describe('getEquipmentCatalogDelta', () => {
  it('passes category and watermark through', async () => {
    mockRpc.mockResolvedValue({ data: { upserts: [], tombstone_ids: [], synced_at: 't' }, error: null });
    await getEquipmentCatalogDelta('blade', '2026-06-01T00:00:00Z');
    expect(mockRpc).toHaveBeenCalledWith('get_equipment_catalog_delta', {
      p_category: 'blade',
      p_since: '2026-06-01T00:00:00Z',
    });
  });
});
