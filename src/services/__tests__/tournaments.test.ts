import { createBracket, reportSlot, getBracket } from '../tournaments';

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

beforeEach(() => jest.clearAllMocks());

describe('tournaments writes (F032)', () => {
  it('createBracket forwards the event id', async () => {
    mockRpc.mockResolvedValue({ data: 5, error: null });
    await createBracket(7);
    expect(mockRpc).toHaveBeenCalledWith('create_tournament_bracket', { p_event_id: 7 });
  });

  it('reportSlot forwards slot/winner/sets', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await reportSlot(9, 'w1', [{ a: 11, b: 8 }]);
    expect(mockRpc).toHaveBeenCalledWith('report_tournament_slot', { p_slot_id: 9, p_winner_id: 'w1', p_sets: [{ a: 11, b: 8 }] });
  });
});

describe('getBracket (F032)', () => {
  it('folds flat rows into a bracket + slots', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { bracket_id: 1, size: 4, bracket_status: 'active', champion_id: null, champion_name: null,
          slot_id: 10, round: 1, slot_pos: 0, player_a: 'a', player_a_name: 'Ana', player_b: 'b', player_b_name: 'Bob', winner_id: 'a', sets: [{ a: 11, b: 9 }] },
        { bracket_id: 1, size: 4, bracket_status: 'active', champion_id: null, champion_name: null,
          slot_id: 11, round: 2, slot_pos: 0, player_a: 'a', player_a_name: 'Ana', player_b: null, player_b_name: null, winner_id: null, sets: null },
      ],
      error: null,
    });
    const { data } = await getBracket(1);
    expect(data?.bracketId).toBe(1);
    expect(data?.size).toBe(4);
    expect(data?.slots).toHaveLength(2);
    expect(data?.slots[0]).toMatchObject({ slotId: 10, round: 1, winnerId: 'a' });
    expect(data?.slots[1].sets).toEqual([]); // null → []
  });

  it('returns null when there is no bracket', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const { data } = await getBracket(1);
    expect(data).toBeNull();
  });
});
