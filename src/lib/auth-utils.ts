import type { AuthError } from '@supabase/supabase-js';

/** Validates email format using basic RFC 5322 pattern. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Maps a Supabase AuthError to an i18n error key. */
export function mapAuthErrorToKey(error: AuthError): string {
  if (
    error.code === 'user_already_exists' ||
    error.message?.includes('already registered')
  ) {
    return 'errorDuplicateEmail';
  }
  if (
    error.code === 'invalid_credentials' ||
    error.message?.includes('Invalid login credentials')
  ) {
    return 'errorInvalidCredentials';
  }
  if (
    error.name === 'AuthRetryableFetchError' ||
    error.message?.includes('Failed to fetch')
  ) {
    return 'errorNetwork';
  }
  return 'errorNetwork';
}
