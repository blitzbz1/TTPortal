import { sanitizeRoute } from './auth-utils';

/**
 * Builds the in-app route for a notification's data payload.
 *
 * Shared by the notification inbox and the push-tap handlers so every
 * surface resolves notifications the same way. Handles both `eventId`
 * (camelCase, written by most triggers) and `event_id` (snake_case,
 * written by migration 012's event reminders).
 *
 * Returns null when the payload carries no usable screen.
 */
export function buildRouteFromNotificationData(data: unknown): string | null {
  const d = data as
    | { screen?: unknown; eventId?: unknown; event_id?: unknown }
    | null
    | undefined;
  if (!d || typeof d.screen !== 'string' || !d.screen) return null;

  const safeRoute = sanitizeRoute(d.screen);
  const eventId = d.eventId ?? d.event_id;
  if (
    (typeof eventId === 'string' || typeof eventId === 'number') &&
    `${eventId}` !== '' &&
    !safeRoute.includes('?')
  ) {
    return `${safeRoute}?eventId=${eventId}`;
  }
  return safeRoute;
}
