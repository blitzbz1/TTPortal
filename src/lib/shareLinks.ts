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

export function playerUrl(userId: string): string {
  return `${getWebAppUrl()}/player/${userId}`;
}

/** F040: a shareable club-join link carrying the 6-char join code. */
export function clubUrl(joinCode: string): string {
  return `${getWebAppUrl()}/join/${joinCode}`;
}

/**
 * F041: a shareable referral link carrying the inviter's 6-char referral code.
 * Shares the `/join/<code>` route with club links — the route tries a referral
 * claim first and falls back to club-join, so one path serves both codes.
 */
export function joinUrl(code: string): string {
  return `${getWebAppUrl()}/join/${code}`;
}

/**
 * F034: a Quick-Match QR encodes a player link with ?logMatch=1, so scanning it
 * opens that player's profile with the Log Match sheet pre-targeted at them.
 */
export function playerLogMatchUrl(userId: string): string {
  return `${playerUrl(userId)}?logMatch=1`;
}

/**
 * Parse a scanned Quick-Match URL → the opponent's user id (or null). Tolerant
 * of any host/base; only the `/player/<id>` path segment matters for same-device
 * pairing (we route directly rather than relying on OS link verification).
 */
export function parseQuickMatchUserId(scanned: string): string | null {
  if (!scanned) return null;
  const m = scanned.match(/\/player\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Builds the payload for Share.share(): the URL rides in the message on
 * Android (which ignores `url`) and rides separately on iOS/web so share
 * targets receive clean text + URL instead of one composed message.
 */
export function sharePayload(message: string, url: string): { message: string; url?: string } {
  if (Platform.OS === 'ios' || Platform.OS === 'web') {
    return { message, url };
  }
  return { message: `${message}\n${url}` };
}
