import { submitVenueChangeRequest } from '../venueChangeRequests';

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

beforeEach(() => jest.clearAllMocks());

describe('submitVenueChangeRequest', () => {
  it('maps the full input to the submit RPC params', async () => {
    mockRpc.mockResolvedValue({ data: 7, error: null });

    const { data, error } = await submitVenueChangeRequest(42, {
      nets: true,
      nightLighting: false,
      tablesCount: 3,
      markUnavailable: true,
      note: '  gone  ',
    });

    expect(mockRpc).toHaveBeenCalledWith('submit_venue_change_request', {
      p_venue_id: 42,
      p_nets: true,
      p_night_lighting: false,
      p_tables_count: 3,
      p_mark_unavailable: true,
      p_note: '  gone  ',
    });
    expect(data).toBe(7);
    expect(error).toBeNull();
  });

  it('defaults missing fields to null / false', async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });

    await submitVenueChangeRequest(9, {});

    expect(mockRpc).toHaveBeenCalledWith('submit_venue_change_request', {
      p_venue_id: 9,
      p_nets: null,
      p_night_lighting: null,
      p_tables_count: null,
      p_mark_unavailable: false,
      p_note: null,
    });
  });

  it('forwards RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'nope' } });

    const { data, error } = await submitVenueChangeRequest(1, { markUnavailable: true });

    expect(error).toEqual({ message: 'nope' });
    expect(data).toBeNull();
  });
});
