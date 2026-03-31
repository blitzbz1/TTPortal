import type { AuthError } from '@supabase/supabase-js';
import { logger } from './logger';

/** Validates email format using basic RFC 5322 pattern. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Validates a route string against an allowlist of internal prefixes. */
export function sanitizeRoute(route?: string): string {
  if (!route) return '/(tabs)';
  const allowed = ['/(tabs)', '/(protected)', '/venue/'];
  if (allowed.some((prefix) => route.startsWith(prefix))) return route;
  return '/(tabs)';
}

/** Escapes LIKE/ILIKE wildcard characters in user input. */
export function escapeLikePattern(input: string): string {
  return input.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Checks password strength: min 8 chars, at least one uppercase and one digit. */
export function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

/** Returns a safe user-facing error message, logging the detailed error for debugging. */
export function safeErrorMessage(error: any, fallbackKey: string, s: (k: string) => string): string {
  logger.warn('API error', { message: error?.message, code: error?.code });
  return s(fallbackKey);
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
