import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import {
  dequeue,
  enqueue,
  getPending,
  isDeadLetter,
  recordFailedAttempt,
  type QueuedChange,
} from '../lib/offlineQueue';
import { getOfflineHandler } from '../lib/offlineHandlers';
import { logger } from '../lib/logger';

interface OfflineQueueContextValue {
  isOnline: boolean;
  pendingCount: number;
  enqueue: (change: Parameters<typeof enqueue>[0]) => QueuedChange;
  flush: () => Promise<void>;
}

const OfflineQueueContext = createContext<OfflineQueueContextValue | null>(null);

export function OfflineQueueProvider({ children }: { children: React.ReactNode }) {
  // isOnline is derived from react-query's onlineManager, which lib/queryClient.ts
  // wires to NetInfo at app start — one NetInfo subscription for the whole app
  // instead of a second listener here, and both systems agree on what "online" means.
  const [isOnline, setIsOnline] = useState(onlineManager.isOnline());
  const [pendingCount, setPendingCount] = useState(0);
  const flushingRef = useRef(false);
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  const refreshCount = useCallback(() => {
    setPendingCount(getPending().length);
  }, []);

  // Replay handlers live in the module-level registry (lib/offlineHandlers) —
  // they exist regardless of which screens are mounted, so changes queued on
  // one screen replay even after the user navigates away.
  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const pending = getPending();
      for (const change of pending) {
        // Dead-letter: drop entries that exhausted retries or aged out, and
        // log loudly (logger feeds Grafana) so silent data loss is visible.
        if (isDeadLetter(change)) {
          logger.error('OfflineQueue: dead-letter, dropping change', {
            id: change.id,
            entityType: change.entityType,
            attempts: change.attempts,
            ageMs: Date.now() - change.enqueuedAt,
          });
          dequeue(change.id);
          continue;
        }
        const handler = getOfflineHandler(change.entityType);
        if (!handler) continue;
        try {
          const result = await handler(change);
          if (!result || !('error' in result) || !result.error) {
            dequeue(change.id);
          } else {
            recordFailedAttempt(change.id);
            logger.warn('OfflineQueue: handler returned error, leaving queued', { id: change.id });
          }
        } catch (err) {
          recordFailedAttempt(change.id);
          logger.warn('OfflineQueue: handler threw, leaving queued', { id: change.id, err: String(err) });
        }
      }
      refreshCount();
    } finally {
      flushingRef.current = false;
    }
  }, [refreshCount]);

  // Cold start: changes queued in a previous session must replay without
  // waiting for an offline→online transition that may never happen.
  useEffect(() => {
    refreshCount();
    if (getPending().length > 0 && onlineManager.isOnline()) {
      void flush();
    }
  }, [flush, refreshCount]);

  // Offline→online transition.
  useEffect(() => {
    const unsubscribe = onlineManager.subscribe((online) => {
      setIsOnline(online);
      if (online) {
        void flush();
      }
    });
    return unsubscribe;
  }, [flush]);

  // Foreground: the app may have regained connectivity while backgrounded
  // without NetInfo emitting an event we observed.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active' && getPending().length > 0 && onlineManager.isOnline()) {
        void flush();
      }
    });
    return () => sub.remove();
  }, [flush]);

  // Flushing right after enqueue while online covers flapping connections:
  // the change was queued because a request failed, but connectivity may
  // already be back. flush() is reentrancy-guarded, so this is cheap.
  const enqueueWithRefresh = useCallback(
    (change: Parameters<typeof enqueue>[0]) => {
      const item = enqueue(change);
      refreshCount();
      if (isOnlineRef.current) {
        void flush();
      }
      return item;
    },
    [refreshCount, flush],
  );

  return (
    <OfflineQueueContext.Provider
      value={{ isOnline, pendingCount, enqueue: enqueueWithRefresh, flush }}
    >
      {children}
    </OfflineQueueContext.Provider>
  );
}

export function useOfflineQueue(): OfflineQueueContextValue {
  const ctx = useContext(OfflineQueueContext);
  if (!ctx) throw new Error('useOfflineQueue must be used within OfflineQueueProvider');
  return ctx;
}
