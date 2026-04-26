import { sendAppInviteEmail } from '../invites';

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

const mockInvoke = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: any[]) => mockInvoke(...args),
    },
  },
}));

describe('sendAppInviteEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invokes the send-app-invite function with normalized email', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

    await sendAppInviteEmail(' Friend@Example.com ');

    expect(mockInvoke).toHaveBeenCalledWith('send-app-invite', {
      body: { email: 'friend@example.com' },
    });
  });

  it('returns errors from the function', async () => {
    const error = { message: 'failed' };
    mockInvoke.mockResolvedValue({ data: null, error });

    const result = await sendAppInviteEmail('friend@example.com');

    expect(result.error).toEqual(error);
  });
});
