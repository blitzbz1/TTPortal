import { queryClient } from './queryClient';
import { addFavorite, removeFavorite } from '../services/favorites';
import {
  markAsRead as markNotificationRead,
  deleteNotification as deleteNotificationService,
} from '../services/notifications';
import { checkin, getUserAnyActiveCheckin } from '../services/checkins';
import type { CheckinInsert } from '../types/database';
import type { QueuedChange } from './offlineQueue';

/**
 * Module-level registry of offline replay handlers.
 *
 * Handlers used to register inside component effects (useFavoritesQuery,
 * NotificationProvider), which meant a change only replayed while the
 * registering screen was mounted — a favorite toggled offline never synced
 * once the user navigated away — and two consumers of one entityType
 * clobbered each other's registration on unmount. This registry is plain
 * module state imported by OfflineQueueProvider, so every handler exists
 * for the app's whole lifetime.
 *
 * Contract: return `{ error }` (or throw) to leave the change queued for a
 * retry; resolve cleanly to dequeue it. Optimistic UI updates happen at
 * enqueue time in the hooks/providers — replay only performs the server
 * write and invalidates the affected query keys.
 */
export type ReplayHandler = (
  change: QueuedChange,
) => Promise<{ error?: unknown } | void>;

const handlers: Record<string, ReplayHandler> = {
  favorite: async (change) => {
    const payload = change.payload as {
      userId: string;
      venueId: number;
      operation: 'add' | 'remove';
    };
    const result =
      payload.operation === 'remove'
        ? await removeFavorite(payload.userId, payload.venueId)
        : await addFavorite(payload.userId, payload.venueId);
    if (result.error) return { error: result.error };
    queryClient.invalidateQueries({ queryKey: ['favorites', payload.userId] });
  },

  'notification-read': async (change) => {
    const { id, userId } = change.payload as { id: number; userId: string };
    const result = await markNotificationRead(id, userId);
    if (result.error) return { error: result.error };
  },

  'notification-delete': async (change) => {
    const { id, userId } = change.payload as { id: number; userId: string };
    const result = await deleteNotificationService(id, userId);
    if (result.error) return { error: result.error };
  },

  // Check-ins queued offline replay with their ORIGINAL timestamps — the
  // session happened when it happened, and the B2B analytics depend on
  // honest started_at values.
  //
  // One-active-check-in reconciliation (decided in T031): if the queued
  // check-in would still be "active" at replay time but the user has since
  // checked in at a DIFFERENT venue, the queued (older) one is closed at
  // now() — the session is recorded without creating double presence. A
  // still-active check-in at the SAME venue supersedes the queued one
  // entirely, so the replay no-ops.
  checkin: async (change) => {
    const payload = change.payload as CheckinInsert;
    const now = new Date();
    const stillActive = payload.ended_at != null && new Date(payload.ended_at) > now;

    if (stillActive) {
      const { data: active } = await getUserAnyActiveCheckin(payload.user_id);
      if (active) {
        if (active.venue_id === payload.venue_id) {
          return; // superseded by the live check-in at the same venue
        }
        payload.ended_at = now.toISOString(); // close the older one
      }
    }

    const result = await checkin(payload);
    if (result.error) return { error: result.error };
    queryClient.invalidateQueries({ queryKey: ['venue-detail', payload.venue_id] });
  },
};

export function getOfflineHandler(entityType: string): ReplayHandler | undefined {
  return handlers[entityType];
}

/**
 * Extension point for feature modules that own their replay logic (e.g.
 * check-ins register here from the service layer). Registration is
 * module-level — call it at import time, not from a component.
 */
export function registerOfflineHandler(entityType: string, handler: ReplayHandler): void {
  handlers[entityType] = handler;
}
