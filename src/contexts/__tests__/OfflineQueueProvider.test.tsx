import React, { useEffect } from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { OfflineQueueProvider, useOfflineQueue } from '../OfflineQueueProvider';
import {
  MAX_REPLAY_ATTEMPTS,
  clear,
  enqueue,
  getPending,
  recordFailedAttempt,
} from '../../lib/offlineQueue';

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    track: jest.fn(),
  },
}));

// Replay handlers are module-level (lib/offlineHandlers); tests drive a
// controllable map instead of the real service-backed handlers.
const mockHandlers: Record<string, jest.Mock> = {};
jest.mock('../../lib/offlineHandlers', () => ({
  getOfflineHandler: (entityType: string) => mockHandlers[entityType],
}));

import { logger } from '../../lib/logger';

function Harness({ onCtx }: { onCtx?: (ctx: any) => void }) {
  function Consumer() {
    const ctx = useOfflineQueue();
    useEffect(() => {
      onCtx?.(ctx);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  }
  return (
    <OfflineQueueProvider>
      <Consumer />
    </OfflineQueueProvider>
  );
}

describe('OfflineQueueProvider', () => {
  let favoriteHandler: jest.Mock;

  beforeEach(() => {
    clear();
    onlineManager.setOnline(true);
    favoriteHandler = jest.fn().mockResolvedValue(undefined);
    mockHandlers.favorite = favoriteHandler;
  });

  afterEach(() => {
    clear();
    onlineManager.setOnline(true);
    delete mockHandlers.favorite;
  });

  it('flushes pending changes on mount when online (cold start) — no screen registration needed', async () => {
    // Queued in a "previous session", before anything mounts.
    enqueue({ entityType: 'favorite', entityId: 'v1', operation: 'create', payload: {} });

    render(<Harness />);

    await waitFor(() => expect(favoriteHandler).toHaveBeenCalledTimes(1));
    expect(getPending()).toHaveLength(0);
  });

  it('does not flush on mount while offline, then flushes on reconnect', async () => {
    enqueue({ entityType: 'favorite', entityId: 'v1', operation: 'create', payload: {} });

    onlineManager.setOnline(false);
    render(<Harness />);

    await act(async () => {});
    expect(favoriteHandler).not.toHaveBeenCalled();
    expect(getPending()).toHaveLength(1);

    await act(async () => {
      onlineManager.setOnline(true);
    });
    await waitFor(() => expect(favoriteHandler).toHaveBeenCalledTimes(1));
    expect(getPending()).toHaveLength(0);
  });

  it('flushes when the app returns to the foreground with pending items', async () => {
    render(<Harness />);
    await act(async () => {});

    onlineManager.setOnline(false);
    enqueue({ entityType: 'favorite', entityId: 'v2', operation: 'create', payload: {} });
    onlineManager.setOnline(true);
    favoriteHandler.mockClear();

    const addListener = AppState.addEventListener as unknown as jest.Mock;
    const change = addListener.mock.calls.find((c: any[]) => c[0] === 'change');
    expect(change).toBeTruthy();
    await act(async () => {
      change![1]('active');
    });

    await waitFor(() => expect(getPending()).toHaveLength(0));
  });

  it('flushes immediately after enqueue while online', async () => {
    let ctx: any;
    render(<Harness onCtx={(c) => (ctx = c)} />);
    await act(async () => {});
    favoriteHandler.mockClear();

    await act(async () => {
      ctx.enqueue({ entityType: 'favorite', entityId: 'v3', operation: 'create', payload: {} });
    });

    await waitFor(() => expect(favoriteHandler).toHaveBeenCalledTimes(1));
    expect(getPending()).toHaveLength(0);
  });

  it('records a failed attempt and leaves items queued when the handler errors', async () => {
    favoriteHandler.mockResolvedValue({ error: new Error('rls') });
    let ctx: any;
    render(<Harness onCtx={(c) => (ctx = c)} />);
    await act(async () => {});

    await act(async () => {
      ctx.enqueue({ entityType: 'favorite', entityId: 'v4', operation: 'create', payload: {} });
    });

    await waitFor(() => expect(favoriteHandler).toHaveBeenCalled());
    const pending = getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].attempts).toBeGreaterThanOrEqual(1);
  });

  it('records a failed attempt when the handler throws', async () => {
    favoriteHandler.mockRejectedValue(new Error('boom'));
    let ctx: any;
    render(<Harness onCtx={(c) => (ctx = c)} />);
    await act(async () => {});

    await act(async () => {
      ctx.enqueue({ entityType: 'favorite', entityId: 'v5', operation: 'create', payload: {} });
    });

    await waitFor(() => expect(favoriteHandler).toHaveBeenCalled());
    expect(getPending()[0].attempts).toBeGreaterThanOrEqual(1);
  });

  it('dead-letters changes that exhausted their retries instead of replaying them', async () => {
    const item = enqueue({ entityType: 'favorite', entityId: 'v6', operation: 'create', payload: {} });
    for (let i = 0; i < MAX_REPLAY_ATTEMPTS; i++) recordFailedAttempt(item.id);

    render(<Harness />);

    await waitFor(() => expect(getPending()).toHaveLength(0));
    expect(favoriteHandler).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'OfflineQueue: dead-letter, dropping change',
      expect.objectContaining({ entityType: 'favorite' }),
    );
  });

  it('leaves changes without a registered handler queued', async () => {
    enqueue({ entityType: 'unknown-type', entityId: 'v7', operation: 'create', payload: {} });

    render(<Harness />);
    await act(async () => {});

    expect(getPending()).toHaveLength(1);
  });
});
