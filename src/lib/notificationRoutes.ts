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
    | {
        screen?: unknown;
        eventId?: unknown;
        event_id?: unknown;
        threadId?: unknown;
        week?: unknown;
      }
    | null
    | undefined;
  if (!d || typeof d.screen !== 'string' || !d.screen) return null;

  const safeRoute = sanitizeRoute(d.screen);

  // F023: a dm_message routes to the specific thread under the messages screen.
  const threadId = d.threadId;
  if (
    (typeof threadId === 'string' || typeof threadId === 'number') &&
    `${threadId}` !== '' &&
    safeRoute.endsWith('/messages')
  ) {
    return `${safeRoute}/${threadId}`;
  }

  const eventId = d.eventId ?? d.event_id;
  if (
    (typeof eventId === 'string' || typeof eventId === 'number') &&
    `${eventId}` !== '' &&
    !safeRoute.includes('?')
  ) {
    return `${safeRoute}?eventId=${eventId}`;
  }

  // F052: the weekly-recap push carries the exact `week` it summarizes; forward
  // it so a delayed tap opens that week rather than the screen's now-relative
  // default (which would show the wrong/empty week days later).
  const week = d.week;
  if (
    (typeof week === 'string' || typeof week === 'number') &&
    `${week}` !== '' &&
    !safeRoute.includes('?')
  ) {
    return `${safeRoute}?week=${week}`;
  }
  return safeRoute;
}
