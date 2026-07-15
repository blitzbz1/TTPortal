import type { AuthError } from '@supabase/supabase-js';

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    track: jest.fn(),
  },
}));

const duplicateEmailError = {
  code: 'user_already_exists',
  message: 'User already registered',
  name: 'AuthApiError',
  status: 422,
} as unknown as AuthError;

const invalidCredentialsError = {
  code: 'invalid_credentials',
  message: 'Invalid login credentials',
  name: 'AuthApiError',
  status: 400,
} as unknown as AuthError;

const networkError = {
  message: 'Failed to fetch',
  name: 'AuthRetryableFetchError',
  status: 0,
} as unknown as AuthError;

/** Loads a fresh copy of auth-utils with SOCIAL_AUTH_ENABLED forced to the given value. */
function loadWithSocialAuth(enabled: boolean) {
  let mod: typeof import('../auth-utils');
  jest.isolateModules(() => {
    jest.doMock('../featureFlags', () => ({ SOCIAL_AUTH_ENABLED: enabled }));
    mod = require('../auth-utils');
  });
  return mod!;
}

describe('mapAuthErrorToKey', () => {
  afterEach(() => {
    jest.dontMock('../featureFlags');
  });

  it('suggests the OAuth providers for duplicate email when social auth is enabled', () => {
    const { mapAuthErrorToKey } = loadWithSocialAuth(true);
    expect(mapAuthErrorToKey(duplicateEmailError)).toBe('errorDuplicateEmail');
  });

  it('does not suggest OAuth providers for duplicate email when social auth is disabled', () => {
    const { mapAuthErrorToKey } = loadWithSocialAuth(false);
    expect(mapAuthErrorToKey(duplicateEmailError)).toBe('errorDuplicateEmailNoSocial');
  });

  it('maps invalid credentials regardless of the flag', () => {
    expect(loadWithSocialAuth(true).mapAuthErrorToKey(invalidCredentialsError)).toBe(
      'errorInvalidCredentials',
    );
    expect(loadWithSocialAuth(false).mapAuthErrorToKey(invalidCredentialsError)).toBe(
      'errorInvalidCredentials',
    );
  });

  it('maps retryable fetch errors to the network key', () => {
    expect(loadWithSocialAuth(false).mapAuthErrorToKey(networkError)).toBe('errorNetwork');
  });
});

describe('mapAuthErrorToKey copy variants', () => {
  it('flag-off copy exists in every locale and never mentions Google/Apple', () => {
    const locales = ['en', 'de', 'pl', 'ro', 'it', 'fr', 'es', 'cs'] as const;
    for (const locale of locales) {
      const messages: Record<string, string> = require(`../../locales/${locale}.json`);
      const copy = messages.errorDuplicateEmailNoSocial;
      expect(copy).toBeTruthy();
      expect(copy).not.toMatch(/Google|Apple/);
    }
  });
});
