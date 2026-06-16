// T070: equipment history/current selection + cache invalidation coupling.
import { createQueryChain } from '../../test-utils/supabaseMock';
import { getEquipmentHistory, getCurrentEquipmentForUser, saveEquipmentSelection, getRubberWear } from '../equipment';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

const mockInvalidate = jest.fn();
jest.mock('../../lib/equipmentCache', () => ({
  invalidateEquipmentCache: (...args: any[]) => mockInvalidate(...args),
}));

beforeEach(() => jest.clearAllMocks());

describe('getEquipmentHistory', () => {
  it('returns the newest entries first, default limit 4', async () => {
    const chain = createQueryChain([]);
    mockFrom.mockReturnValue(chain);
    await getEquipmentHistory('u-1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u-1');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(4);
  });
});

describe('getCurrentEquipmentForUser', () => {
  it('calls the RPC with the user id', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await getCurrentEquipmentForUser('u-1');
    expect(mockRpc).toHaveBeenCalledWith('current_equipment_for_user', { v_user_id: 'u-1' });
  });
});

describe('getRubberWear', () => {
  // F061 regression: Postgres `numeric` (expected_hours/estimated_hours) is
  // serialized as a STRING by PostgREST; without coercion the wear-card stepper
  // string-concatenates ("60" + 10 = "6010") and the pct bars break.
  it('coerces numeric columns returned as strings to numbers', async () => {
    mockRpc.mockResolvedValue({
      data: [{ side: 'forehand', installed_at: '2025-01-01', expected_hours: '60', estimated_hours: '12.5', pct: 21 }],
      error: null,
    });
    const { data } = await getRubberWear('u-1');
    expect(mockRpc).toHaveBeenCalledWith('get_rubber_wear', { p_user_id: 'u-1' });
    expect(data?.[0].expected_hours).toBe(60);
    expect(data?.[0].estimated_hours).toBe(12.5);
    expect(typeof data?.[0].expected_hours).toBe('number');
  });
});

describe('saveEquipmentSelection', () => {
  it('inserts and invalidates the equipment cache on success', async () => {
    mockFrom.mockReturnValue(createQueryChain({ id: 1 }));
    await saveEquipmentSelection({ user_id: 'u-1', category: 'blade', item_id: 3 } as any);
    expect(mockInvalidate).toHaveBeenCalledWith('u-1');
  });

  it('skips invalidation on error', async () => {
    mockFrom.mockReturnValue(createQueryChain(null, { message: 'rls' }));
    await saveEquipmentSelection({ user_id: 'u-1', category: 'blade', item_id: 3 } as any);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
