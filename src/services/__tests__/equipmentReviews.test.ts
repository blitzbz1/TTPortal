// F062 regression: get_equipment_model_summary returns Postgres `numeric`
// avg_* columns, which PostgREST serializes as STRINGS. Without coercion the
// model page calls "4.5".toFixed(1) and crashes with a TypeError.
import { getEquipmentModelSummary } from '../equipmentReviews';

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: jest.fn(),
  },
}));

beforeEach(() => jest.clearAllMocks());

describe('getEquipmentModelSummary', () => {
  it('coerces the numeric avg_* columns (returned as strings) to numbers', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          review_count: 3,
          avg_rating: '4.5',
          avg_speed: '8.3',
          avg_spin: '7.0',
          avg_control: '6.5',
          users_count: 12,
        },
      ],
      error: null,
    });
    const { data } = await getEquipmentModelSummary('rubber', 'butterfly', 'Tenergy 05');
    expect(mockRpc).toHaveBeenCalledWith('get_equipment_model_summary', {
      p_category: 'rubber',
      p_manufacturer_id: 'butterfly',
      p_model: 'Tenergy 05',
    });
    expect(data?.avg_rating).toBe(4.5);
    expect(typeof data?.avg_rating).toBe('number');
    // .toFixed is now safe (the crash vector).
    expect(data?.avg_rating?.toFixed(1)).toBe('4.5');
    expect(data?.avg_speed).toBe(8.3);
    expect(data?.users_count).toBe(12);
  });

  it('returns null (not a crash) when there are no rows', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const { data } = await getEquipmentModelSummary('blade', 'stiga', 'Allround');
    expect(data).toBeNull();
  });
});
