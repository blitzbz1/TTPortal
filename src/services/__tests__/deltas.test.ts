// T070: the three delta services are thin RPC wrappers — these tests pin
// the RPC names, the param mapping (null → undefined so server defaults
// apply), and error passthrough. The watermark advance/merge logic lives in
// the persistent caches and is covered by their own suites.
import { getVenuesDelta } from '../venuesDelta';
import { getCitiesDelta } from '../citiesDelta';
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

    expect(mockRpc).toHaveBeenCalledWith('get_venues_map_delta', {
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

    expect(mockRpc).toHaveBeenCalledWith('get_venues_map_delta', {
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

describe('getCitiesDelta', () => {
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
