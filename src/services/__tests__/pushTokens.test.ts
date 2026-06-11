// T070: push-token registration lifecycle.
import { createQueryChain } from '../../test-utils/supabaseMock';
import { upsertPushToken, deletePushToken } from '../pushTokens';

const mockFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

beforeEach(() => jest.clearAllMocks());

describe('upsertPushToken', () => {
  it('upserts on (user_id, token) so re-registration refreshes in place', async () => {
    const chain = createQueryChain(null);
    mockFrom.mockReturnValue(chain);

    await upsertPushToken('u-1', 'ExponentPushToken[abc]', 'ios');

    expect(mockFrom).toHaveBeenCalledWith('push_tokens');
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u-1',
        token: 'ExponentPushToken[abc]',
        device_type: 'ios',
        updated_at: expect.any(String),
      }),
      { onConflict: 'user_id,token' },
    );
  });
});

describe('deletePushToken', () => {
  it('deletes the exact (user, token) pair on logout', async () => {
    const chain = createQueryChain(null);
    mockFrom.mockReturnValue(chain);

    await deletePushToken('u-1', 'ExponentPushToken[abc]');

    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u-1');
    expect(chain.eq).toHaveBeenCalledWith('token', 'ExponentPushToken[abc]');
  });
});
