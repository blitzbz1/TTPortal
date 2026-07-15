import { getHeadToHead, getRivals } from '../matches';

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

beforeEach(() => jest.clearAllMocks());

describe('getHeadToHead (F031)', () => {
  it('forwards p_opponent_id and maps the record', async () => {
    mockRpc.mockResolvedValue({
      data: { my_wins: 2, their_wins: 1, total: 3, my_sets: 5, their_sets: 3, streak: 1, last5: [true, false, true] },
      error: null,
    });
    const { data } = await getHeadToHead('op1');
    expect(mockRpc).toHaveBeenCalledWith('get_head_to_head', { p_opponent_id: 'op1' });
    expect(data).toEqual({
      my_wins: 2, their_wins: 1, total: 3, my_sets: 5, their_sets: 3, streak: 1, last5: [true, false, true],
    });
  });

  it('defaults missing fields (blocked / no history → total 0)', async () => {
    mockRpc.mockResolvedValue({ data: { total: 0 }, error: null });
    const { data } = await getHeadToHead('op2');
    expect(data).toEqual({ my_wins: 0, their_wins: 0, total: 0, my_sets: 0, their_sets: 0, streak: 0, last5: [] });
  });
});

describe('getRivals (F031)', () => {
  it('returns the rival rows', async () => {
    mockRpc.mockResolvedValue({
      data: [{ user_id: 'b', full_name: 'Bob', avatar_url: null, my_wins: 2, their_wins: 1, total: 3 }],
      error: null,
    });
    const { data } = await getRivals();
    expect(mockRpc).toHaveBeenCalledWith('get_rivals');
    expect(data[0].user_id).toBe('b');
    expect(data[0].total).toBe(3);
  });

  it('defaults to [] when empty', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const { data } = await getRivals();
    expect(data).toEqual([]);
  });
});
