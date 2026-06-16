import {
  createPlayIntent,
  joinPlayIntent,
  leavePlayIntent,
  cancelPlayIntent,
  convertPlayIntentToEvent,
  getOpenPlayCounts,
  getMyPlayIntent,
} from '../openplay';

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

beforeEach(() => jest.clearAllMocks());

describe('openplay writes (F020)', () => {
  it('createPlayIntent forwards the snake_case RPC params', async () => {
    mockRpc.mockResolvedValue({ data: 7, error: null });
    await createPlayIntent({ venueId: 3, whenSlot: 'now', note: 'hi', isPublic: false });
    expect(mockRpc).toHaveBeenCalledWith('create_play_intent', {
      p_venue_id: 3, p_when_slot: 'now', p_note: 'hi', p_public: false,
    });
  });

  it('createPlayIntent defaults note→null and public→true', async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });
    await createPlayIntent({ venueId: 9, whenSlot: 'tonight' });
    expect(mockRpc).toHaveBeenCalledWith('create_play_intent', {
      p_venue_id: 9, p_when_slot: 'tonight', p_note: null, p_public: true,
    });
  });

  it('join/leave/cancel/convert call their RPCs', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await joinPlayIntent(5);
    expect(mockRpc).toHaveBeenCalledWith('join_play_intent', { p_intent_id: 5 });
    await leavePlayIntent(5);
    expect(mockRpc).toHaveBeenCalledWith('leave_play_intent', { p_intent_id: 5 });
    await cancelPlayIntent(5);
    expect(mockRpc).toHaveBeenCalledWith('cancel_play_intent', { p_intent_id: 5 });
    await convertPlayIntentToEvent(5, 'T');
    expect(mockRpc).toHaveBeenCalledWith('convert_play_intent_to_event', { p_intent_id: 5, p_title: 'T' });
  });
});

describe('openplay reads (F020)', () => {
  it('getOpenPlayCounts returns a Map keyed by venue', async () => {
    mockRpc.mockResolvedValue({
      data: [{ venue_id: 2, broadcast_count: 1 }, { venue_id: 5, broadcast_count: 4 }],
      error: null,
    });
    const { data } = await getOpenPlayCounts(null);
    expect(data.get(2)).toBe(1);
    expect(data.get(5)).toBe(4);
  });

  it('getOpenPlayCounts yields an empty Map on error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { data } = await getOpenPlayCounts(null);
    expect(data.size).toBe(0);
  });

  it('getMyPlayIntent returns null when there is no open broadcast', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const { data } = await getMyPlayIntent();
    expect(data).toBeNull();
  });

  it('getMyPlayIntent maps the single row', async () => {
    mockRpc.mockResolvedValue({
      data: [{
        id: 8, venue_id: 2, venue_name: 'Park', when_slot: 'tonight', note: null,
        visibility: 'public', starts_at: 't1', expires_at: 't2', join_count: 0,
      }],
      error: null,
    });
    const { data } = await getMyPlayIntent();
    expect(data).toEqual({
      id: 8, venueId: 2, venueName: 'Park', whenSlot: 'tonight', note: null,
      visibility: 'public', startsAt: 't1', expiresAt: 't2', joinCount: 0,
    });
  });
});
