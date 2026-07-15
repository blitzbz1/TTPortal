import { sendPasswordChangedEmail } from '../securityEmails';

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

describe('sendPasswordChangedEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = mockFetch;
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    });
  });

  it('posts to the password-changed email endpoint with the active session', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
    });

    const result = await sendPasswordChangedEmail();

    expect(result.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/send-password-changed-email'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      }),
    );
  });

  it('returns unauthorized when there is no active session', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });

    const result = await sendPasswordChangedEmail();

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
      status: 500,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        error: 'Email failed',
        code: 'email_failed',
      })),
    });

    const result = await sendPasswordChangedEmail();

    expect(result.error).toEqual({
      message: 'Email failed',
      code: 'email_failed',
      status: 500,
    });
  });
});
