import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { logger } from '../lib/logger';

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimeOptions {
  channelName: string;
  table: string;
  schema?: string;
  event?: ChangeEvent;
  filter?: string;
  enabled?: boolean;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  onReconnect?: () => void;
}

const MAX_BACKOFF_MS = 30_000;

export function useRealtime(options: RealtimeOptions) {
  const {
    channelName,
    table,
    schema = 'public',
    event = '*',
    filter,
    enabled = true,
    onInsert,
    onUpdate,
    onDelete,
    onReconnect,
  } = options;

  const insertRef = useRef(onInsert);
  const updateRef = useRef(onUpdate);
  const deleteRef = useRef(onDelete);
  const reconnectRef = useRef(onReconnect);
  insertRef.current = onInsert;
  updateRef.current = onUpdate;
  deleteRef.current = onDelete;
  reconnectRef.current = onReconnect;

  useEffect(() => {
    if (!enabled) return;

    let channel: RealtimeChannel | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let wasConnected = false;
    let cancelled = false;

    const teardownChannel = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (channel) {
        supabase.removeChannel(channel).catch(() => {});
        channel = null;
      }
    };

    const subscribeOnce = () => {
      const c = supabase.channel(channelName);

      const config = { event, schema, table, filter } as const;

      if (event === '*' || event === 'INSERT') {
        c.on('postgres_changes', { ...config, event: 'INSERT' } as any, (payload) => insertRef.current?.(payload));
      }
      if (event === '*' || event === 'UPDATE') {
        c.on('postgres_changes', { ...config, event: 'UPDATE' } as any, (payload) => updateRef.current?.(payload));
      }
      if (event === '*' || event === 'DELETE') {
        c.on('postgres_changes', { ...config, event: 'DELETE' } as any, (payload) => deleteRef.current?.(payload));
      }

      c.subscribe((status) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          if (wasConnected && reconnectRef.current) {
            reconnectRef.current();
          }
          attempts = 0;
          wasConnected = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (channel) {
            supabase.removeChannel(channel).catch(() => {});
            channel = null;
          }
          // Exponential backoff with full jitter — every retry picks a
          // random delay in [0, cap) where cap doubles each attempt.
          // Without jitter, every disconnected client retries in lockstep
          // and amplifies the load on whatever just failed; jitter spreads
          // them out. Max 30s.
          const cap = Math.min(1000 * Math.pow(2, attempts), MAX_BACKOFF_MS);
          const delay = Math.floor(Math.random() * cap);
          attempts += 1;
          logger.debug('useRealtime: reconnecting', { channelName, status, delay, attempts });
          reconnectTimer = setTimeout(() => {
            if (!cancelled) {
              channel = subscribeOnce();
            }
          }, delay);
        }
      });

      return c;
    };

    // App-state-aware: tear down the realtime channel when the app
    // backgrounds and bring it back when it foregrounds. Each realtime
    // connection is a slot on the project's WebSocket pool — leaving
    // them open while the app is idle is wasteful, and on the Nano tier
    // it pushes against the connection cap unnecessarily.
    const handleAppStateChange = (next: AppStateStatus) => {
      if (next === 'active') {
        if (!channel && !cancelled) {
          attempts = 0;
          channel = subscribeOnce();
        }
      } else if (next === 'background' || next === 'inactive') {
        teardownChannel();
      }
    };

    if (AppState.currentState === 'active') {
      channel = subscribeOnce();
    }
    const sub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      cancelled = true;
      sub.remove();
      teardownChannel();
    };
  }, [channelName, table, schema, event, filter, enabled]);
}
