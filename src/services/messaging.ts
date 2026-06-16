// F023: 1:1 direct messages service. Thin wrappers over the SECURITY DEFINER
// RPCs in migration 118 (not in generated types → bound callRpc shim; the
// `.bind(supabase)` is load-bearing, see __tests__/rpcBinding.test.ts).
// Push + fetch-on-focus only — no realtime.
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { reportContent, type ReportReason } from './moderation';

type RpcResponse<T> = Promise<{ data: T | null; error: PostgrestError | null }>;
const callRpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  params?: Record<string, unknown>,
) => RpcResponse<unknown>;

export interface DmThread {
  threadId: number;
  otherId: string;
  otherName: string | null;
  otherAvatar: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface DmMessage {
  id: number;
  senderId: string;
  body: string;
  createdAt: string;
  isMine: boolean;
}

// --- writes / actions ------------------------------------------------------
export async function getOrCreateDmThread(otherId: string): Promise<{ data: number | null; error: PostgrestError | null }> {
  const { data, error } = await callRpc('get_or_create_dm_thread', { p_other: otherId });
  return { data: (data as number | null) ?? null, error };
}

export function sendDm(threadId: number, body: string) {
  return callRpc('send_dm', { p_thread_id: threadId, p_body: body });
}

export function markDmThreadRead(threadId: number) {
  return callRpc('mark_dm_thread_read', { p_thread_id: threadId });
}

export function reportDm(messageId: number, reason: ReportReason, notes?: string) {
  return reportContent('dm_message', String(messageId), reason, notes);
}

export async function canMessage(otherId: string): Promise<boolean> {
  const { data, error } = await callRpc('can_message', { p_other: otherId });
  if (error) return false;
  return data === true;
}

// --- reads -----------------------------------------------------------------
interface ThreadRpcRow {
  thread_id: number; other_id: string; other_name: string | null; other_avatar: string | null;
  last_message: string | null; last_message_at: string | null; unread_count: number;
}

export async function getDmThreads(): Promise<{ data: DmThread[]; error: PostgrestError | null }> {
  const { data, error } = await callRpc('get_dm_threads', {});
  if (error || !data) return { data: [], error };
  const items = (data as ThreadRpcRow[]).map((r) => ({
    threadId: r.thread_id, otherId: r.other_id, otherName: r.other_name, otherAvatar: r.other_avatar,
    lastMessage: r.last_message, lastMessageAt: r.last_message_at, unreadCount: r.unread_count,
  }));
  return { data: items, error: null };
}

interface MessageRpcRow {
  id: number; sender_id: string; body: string; created_at: string; is_mine: boolean;
}

/** Returns the latest `limit` messages in chronological (oldest→newest) order. */
export async function getDmMessages(threadId: number, limit = 50): Promise<{ data: DmMessage[]; error: PostgrestError | null }> {
  const { data, error } = await callRpc('get_dm_messages', { p_thread_id: threadId, p_limit: limit });
  if (error || !data) return { data: [], error };
  const items = (data as MessageRpcRow[]).map((r) => ({
    id: r.id, senderId: r.sender_id, body: r.body, createdAt: r.created_at, isMine: r.is_mine,
  }));
  // RPC returns newest-first; the thread view renders oldest-first.
  items.reverse();
  return { data: items, error: null };
}

export async function getUnreadDmCount(): Promise<{ data: number; error: PostgrestError | null }> {
  const { data, error } = await callRpc('get_unread_dm_count', {});
  return { data: (data as number | null) ?? 0, error };
}
