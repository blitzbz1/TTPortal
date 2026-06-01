import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { dequeue, enqueue, getPending, type QueuedChange } from '../lib/offlineQueue';
import { logger } from '../lib/logger';

type Handler = (change: QueuedChange) => Promise<{ error?: unknown } | void>;

interface OfflineQueueContextValue {
  isOnline: boolean;
  pendingCount: number;
  enqueue: (change: Parameters<typeof enqueue>[0]) => QueuedChange;
  registerHandler: (entityType: string, handler: Handler) => () => void;
  flush: () => Promise<void>;
}

const OfflineQueueContext = createContext<OfflineQueueContextValue | null>(null);

export function OfflineQueueProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const handlersRef = useRef<Map<string, Handler>>(new Map());
  const wasOfflineRef = useRef(false);
  const flushingRef = useRef(false);

  const refreshCount = useCallback(() => {
    setPendingCount(getPending().length);
  }, []);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const pending = getPending();
      for (const change of pending) {
        const handler = handlersRef.current.get(change.entityType);
        if (!handler) continue;
        try {
          const result = await handler(change);
          if (!result || !('error' in result) || !result.error) {
            dequeue(change.id);
          } else {
            logger.warn('OfflineQueue: handler returned error, leaving queued', { id: change.id });
          }
        } catch (err) {
          logger.warn('OfflineQueue: handler threw, leaving queued', { id: change.id, err: String(err) });
        }
      }
      refreshCount();
    } finally {
      flushingRef.current = false;
    }
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();
    const sub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online && wasOfflineRef.current) {
        wasOfflineRef.current = false;
        void flush();
      } else if (!online) {
        wasOfflineRef.current = true;
      }
    });
    return () => {
      sub();
    };
  }, [flush, refreshCount]);

  const enqueueWithRefresh = useCallback(
    (change: Parameters<typeof enqueue>[0]) => {
      const item = enqueue(change);
      refreshCount();
      return item;
    },
    [refreshCount],
  );

  const registerHandler = useCallback((entityType: string, handler: Handler) => {
    handlersRef.current.set(entityType, handler);
    return () => {
      handlersRef.current.delete(entityType);
    };
  }, []);

  return (
    <OfflineQueueContext.Provider
      value={{ isOnline, pendingCount, enqueue: enqueueWithRefresh, registerHandler, flush }}
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
