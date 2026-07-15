import { createMMKV } from 'react-native-mmkv';
import {
  MAX_QUEUE_AGE_MS,
  MAX_QUEUE_LENGTH,
  MAX_REPLAY_ATTEMPTS,
  clear,
  dequeue,
  enqueue,
  getPending,
  isDeadLetter,
  recordFailedAttempt,
} from '../offlineQueue';

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    track: jest.fn(),
  },
}));

const store = createMMKV({ id: 'offline-queue' });

beforeEach(() => clear());

describe('enqueue', () => {
  it('dedups same (entityType, entityId, operation) keeping the newest payload', () => {
    enqueue({ entityType: 'favorite', entityId: 'u1:5', operation: 'create', payload: { v: 1 } });
    enqueue({ entityType: 'favorite', entityId: 'u1:5', operation: 'create', payload: { v: 2 } });

    const pending = getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].payload).toEqual({ v: 2 });
  });

  it('keeps changes with a different operation or entity', () => {
    enqueue({ entityType: 'favorite', entityId: 'u1:5', operation: 'create', payload: {} });
    enqueue({ entityType: 'favorite', entityId: 'u1:5', operation: 'delete', payload: {} });
    enqueue({ entityType: 'favorite', entityId: 'u1:6', operation: 'create', payload: {} });

    expect(getPending()).toHaveLength(3);
  });

  it('initializes attempts at 0', () => {
    const item = enqueue({ entityType: 'x', entityId: '1', operation: 'create', payload: {} });
    expect(item.attempts).toBe(0);
  });

  it('caps the queue length by dropping the oldest entries', () => {
    for (let i = 0; i < MAX_QUEUE_LENGTH + 5; i++) {
      enqueue({ entityType: 'x', entityId: String(i), operation: 'create', payload: { i } });
    }
    const pending = getPending();
    expect(pending).toHaveLength(MAX_QUEUE_LENGTH);
    // The oldest five were shed.
    expect(pending[0].payload).toEqual({ i: 5 });
  });
});

describe('dequeue / clear', () => {
  it('removes only the matching id', () => {
    const a = enqueue({ entityType: 'x', entityId: '1', operation: 'create', payload: {} });
    enqueue({ entityType: 'x', entityId: '2', operation: 'create', payload: {} });

    dequeue(a.id);

    const pending = getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].entityId).toBe('2');
  });

  it('clear() empties the queue', () => {
    enqueue({ entityType: 'x', entityId: '1', operation: 'create', payload: {} });
    clear();
    expect(getPending()).toEqual([]);
  });
});

describe('corruption fallback', () => {
  it('returns [] when the persisted JSON is corrupted', () => {
    store.set('offline_queue_v1', '{not json');
    expect(getPending()).toEqual([]);
  });

  it('backfills attempts on entries persisted before the field existed', () => {
    store.set(
      'offline_queue_v1',
      JSON.stringify([
        { id: 'legacy-1', entityType: 'x', entityId: '1', operation: 'create', payload: {}, enqueuedAt: Date.now() },
      ]),
    );
    expect(getPending()[0].attempts).toBe(0);
  });
});

describe('dead-letter accounting', () => {
  it('recordFailedAttempt increments and persists the counter', () => {
    const item = enqueue({ entityType: 'x', entityId: '1', operation: 'create', payload: {} });

    expect(recordFailedAttempt(item.id)).toBe(1);
    expect(recordFailedAttempt(item.id)).toBe(2);
    expect(getPending()[0].attempts).toBe(2);
  });

  it('isDeadLetter triggers on attempt exhaustion', () => {
    const item = enqueue({ entityType: 'x', entityId: '1', operation: 'create', payload: {} });
    for (let i = 0; i < MAX_REPLAY_ATTEMPTS; i++) recordFailedAttempt(item.id);
    expect(isDeadLetter(getPending()[0])).toBe(true);
  });

  it('isDeadLetter triggers on age', () => {
    const item = enqueue({ entityType: 'x', entityId: '1', operation: 'create', payload: {} });
    expect(isDeadLetter(item, item.enqueuedAt + MAX_QUEUE_AGE_MS + 1)).toBe(true);
    expect(isDeadLetter(item, item.enqueuedAt + MAX_QUEUE_AGE_MS - 1)).toBe(false);
  });
});
