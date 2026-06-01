import { createMMKV } from 'react-native-mmkv';
import { logger } from './logger';

const STORE_KEY = 'offline_queue_v1';
const store = createMMKV({ id: 'offline-queue' });

export type QueueOperation = 'create' | 'update' | 'delete';

export interface QueuedChange {
  id: string;
  entityType: string;
  entityId: string;
  operation: QueueOperation;
  payload: unknown;
  enqueuedAt: number;
}

function read(): QueuedChange[] {
  const raw = store.getString(STORE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedChange[];
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

export function enqueue(change: Omit<QueuedChange, 'id' | 'enqueuedAt'>): QueuedChange {
  const all = read();
  const dedup = all.filter(
    (c) => !(c.entityType === change.entityType && c.entityId === change.entityId && c.operation === change.operation),
  );
  const item: QueuedChange = {
    ...change,
    id: `${change.entityType}-${change.entityId}-${change.operation}-${Date.now()}`,
    enqueuedAt: Date.now(),
  };
  dedup.push(item);
  write(dedup);
  logger.debug('offlineQueue: enqueued', { id: item.id });
  return item;
}

export function dequeue(id: string): void {
  const all = read();
  write(all.filter((c) => c.id !== id));
}

export function clear(): void {
  write([]);
}
