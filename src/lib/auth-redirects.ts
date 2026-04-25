import { Platform } from 'react-native';

const DEFAULT_NATIVE_RESET_URL = 'ttportal://reset-password';
const DEFAULT_NATIVE_AUTH_URL = 'ttportal://sign-in';
const DEFAULT_WEB_APP_URL = 'https://www.ttportal.org/TTPortal/app';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function getConfiguredAppUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return trimTrailingSlash(explicit);
  }

  const siteUrl = process.env.EXPO_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    return `${trimTrailingSlash(siteUrl)}/app`;
  }

  return DEFAULT_WEB_APP_URL;
}

function getWebCallbackBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim();
  if (explicit) {
    return trimTrailingSlash(explicit);
  }

  return `${getConfiguredAppUrl()}/auth/callback`;
}

export function getPasswordResetRedirectUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_PASSWORD_RESET_URL?.trim();
  if (explicit) {
    return explicit;
  }

  if (Platform.OS === 'web') {
    return `${getConfiguredAppUrl()}/reset-password`;
  }

  return DEFAULT_NATIVE_RESET_URL;
}

function buildWebCallbackUrl(nextRoute: string, flow: 'oauth' | 'signup') {
  const callbackUrl = new URL(getWebCallbackBaseUrl());
  callbackUrl.searchParams.set('next', sanitizeAppRoute(nextRoute));
  callbackUrl.searchParams.set('flow', flow);
  return callbackUrl.toString();
}

export function getEmailConfirmationRedirectUrl(): string {
  if (Platform.OS === 'web') {
    return buildWebCallbackUrl('/onboarding', 'signup');
  }

  return DEFAULT_NATIVE_AUTH_URL;
}

export function getOAuthRedirectUrl(nextRoute = '/(tabs)'): string {
  if (Platform.OS === 'web') {
    return buildWebCallbackUrl(nextRoute, 'oauth');
  }

  return DEFAULT_NATIVE_AUTH_URL;
}

export function sanitizeAppRoute(route?: string): string {
  if (!route) return '/(tabs)';
  if (!route.startsWith('/') || route.startsWith('//')) return '/(tabs)';

  const allowed = ['/(tabs)', '/(protected)', '/venue/', '/onboarding', '/sign-in'];
  return allowed.some((prefix) => route.startsWith(prefix)) ? route : '/(tabs)';
}
