import { createMMKV } from 'react-native-mmkv';
import { logger } from './logger';

const STORE_KEY = 'offline_queue_v1';
const store = createMMKV({ id: 'offline-queue' });

/** Hard bound on queue length so MMKV growth stays capped. */
export const MAX_QUEUE_LENGTH = 200;
/** A change is dead-lettered after this many failed replay attempts… */
export const MAX_REPLAY_ATTEMPTS = 5;
/** …or once it is older than this (ms). */
export const MAX_QUEUE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type QueueOperation = 'create' | 'update' | 'delete';

export interface QueuedChange {
  id: string;
  entityType: string;
  entityId: string;
  operation: QueueOperation;
  payload: unknown;
  enqueuedAt: number;
  /** Failed replay attempts so far (drives dead-lettering). */
  attempts: number;
}

function read(): QueuedChange[] {
  const raw = store.getString(STORE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueuedChange[];
    // Entries persisted before the dead-letter fields existed.
    return parsed.map((c) => ({ ...c, attempts: c.attempts ?? 0 }));
  } catch {
    return [];
  }
}

function write(changes: QueuedChange[]): void {
  store.set(STORE_KEY, JSON.stringify(changes));
}

export function getPending(): QueuedChange[] {
  return read();
}

export function enqueue(change: Omit<QueuedChange, 'id' | 'enqueuedAt' | 'attempts'>): QueuedChange {
  const all = read();
  const dedup = all.filter(
    (c) => !(c.entityType === change.entityType && c.entityId === change.entityId && c.operation === change.operation),
  );
  const item: QueuedChange = {
    ...change,
    id: `${change.entityType}-${change.entityId}-${change.operation}-${Date.now()}`,
    enqueuedAt: Date.now(),
    attempts: 0,
  };
  dedup.push(item);
  // Bound MMKV growth: drop the oldest entries beyond the cap (they would
  // age into the dead-letter anyway).
  while (dedup.length > MAX_QUEUE_LENGTH) {
    const dropped = dedup.shift();
    logger.warn('offlineQueue: cap exceeded, dropped oldest', { id: dropped?.id });
  }
  write(dedup);
  logger.debug('offlineQueue: enqueued', { id: item.id });
  return item;
}

export function dequeue(id: string): void {
  const all = read();
  write(all.filter((c) => c.id !== id));
}

/** Increment a change's failed-attempt counter; returns the new count. */
export function recordFailedAttempt(id: string): number {
  const all = read();
  let attempts = 0;
  write(
    all.map((c) => {
      if (c.id !== id) return c;
      attempts = c.attempts + 1;
      return { ...c, attempts };
    }),
  );
  return attempts;
}

/** True when a change has exhausted retries or aged out. */
export function isDeadLetter(change: QueuedChange, now = Date.now()): boolean {
  return (
    change.attempts >= MAX_REPLAY_ATTEMPTS ||
    now - change.enqueuedAt > MAX_QUEUE_AGE_MS
  );
}

export function clear(): void {
  write([]);
}
