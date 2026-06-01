import { sendAppInviteEmail } from '../invites';

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

const mockGetSession = jest.fn();
const mockFetch = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: any[]) => mockGetSession(...args),
    },
  },
}));

describe('sendAppInviteEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = mockFetch;
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    });
  });

  it('posts to the send-app-invite endpoint with normalized email', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
    });

    await sendAppInviteEmail(' Friend@Example.com ');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/send-app-invite'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
        body: JSON.stringify({ email: 'friend@example.com' }),
      }),
    );
  });

  it('returns unauthorized when there is no active session', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });

    const result = await sendAppInviteEmail('friend@example.com');

    expect(result.error).toEqual({
      message: 'Unauthorized',
      code: 'unauthorized',
      status: 401,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns errors from the function response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        error: 'User already registered',
        code: 'already_registered',
      })),
    });

    const result = await sendAppInviteEmail('friend@example.com');

    expect(result.error).toEqual({
      message: 'User already registered',
      code: 'already_registered',
      status: 409,
    });
  });
});
