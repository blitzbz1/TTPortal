// T070: account deletion lifecycle wrappers.
import { requestAccountDeletion, cancelAccountDeletion } from '../account';

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

beforeEach(() => jest.clearAllMocks());

describe('requestAccountDeletion', () => {
  it('returns the server-side hard-delete timestamp', async () => {
    mockRpc.mockResolvedValue({ data: '2026-07-11T00:00:00Z', error: null });
    const { data, error } = await requestAccountDeletion();
    expect(mockRpc).toHaveBeenCalledWith('request_account_deletion');
    expect(data).toBe('2026-07-11T00:00:00Z');
    expect(error).toBeNull();
  });

  it('propagates errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'denied' } });
    const { data, error } = await requestAccountDeletion();
    expect(data).toBeNull();
    expect(error).toEqual({ message: 'denied' });
  });
});

describe('cancelAccountDeletion', () => {
  it('calls the cancel RPC and surfaces errors', async () => {
    mockRpc.mockResolvedValue({ error: null });
    expect((await cancelAccountDeletion()).error).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith('cancel_account_deletion');

    mockRpc.mockResolvedValue({ error: { message: 'nope' } });
    expect((await cancelAccountDeletion()).error).toEqual({ message: 'nope' });
  });
});
