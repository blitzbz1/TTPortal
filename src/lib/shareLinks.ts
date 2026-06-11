import { Platform } from 'react-native';

// Mirrors auth-redirects' app-URL resolution (kept separate so importing
// share helpers never drags in the auth/OAuth machinery).
const DEFAULT_WEB_APP_URL = 'https://www.ttportal.org/TTPortal/app';

function getWebAppUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const siteUrl = process.env.EXPO_PUBLIC_SITE_URL?.trim();
  if (siteUrl) return `${siteUrl.replace(/\/+$/, '')}/app`;
  return DEFAULT_WEB_APP_URL;
}

/**
 * Openable web URLs for shared content (T061). The web build already
 * renders /venue/[id] publicly, so these links work for non-users
 * immediately; once universal/app links are configured (associatedDomains
 * + AASA hosting on ttportal.org), the same URLs open in-app.
 */
export function venueUrl(venueId: number | string): string {
  return `${getWebAppUrl()}/venue/${venueId}`;
}

export function eventUrl(eventId: number | string): string {
  return `${getWebAppUrl()}/event/${eventId}`;
}

/**
 * Builds the payload for Share.share(): the URL rides in the message on
 * Android (which ignores `url`) and additionally in the `url` field on iOS
 * (which renders it as a rich link).
 */
export function sharePayload(message: string, url: string): { message: string; url?: string } {
  if (Platform.OS === 'ios') {
    return { message, url };
  }
  return { message: `${message}\n${url}` };
}
