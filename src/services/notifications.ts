import { supabase } from '../lib/supabase';

export async function getNotifications(userId: string, limit = 50) {
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !notifications?.length) return { data: notifications ?? [], error };

  const senderIds = [...new Set(notifications.map((n) => n.sender_id).filter(Boolean))];
  if (!senderIds.length) return { data: notifications.map((n) => ({ ...n, sender: null })), error: null };

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', senderIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const merged = notifications.map((n) => ({
    ...n,
    sender: n.sender_id ? (profileMap.get(n.sender_id) ?? null) : null,
  }));

  return { data: merged, error: null };
}

export async function getUnreadCount(userId: string) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('read', false);

  return { data: count ?? 0, error };
}

export async function markAsRead(notificationId: number, userId: string) {
  return supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('recipient_id', userId);
}

export async function deleteNotification(notificationId: number, userId: string) {
  return supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('recipient_id', userId);
}

export async function deleteAllNotifications(userId: string) {
  return supabase
    .from('notifications')
    .delete()
    .eq('recipient_id', userId);
}

export async function markAllAsRead(userId: string) {
  return supabase
    .from('notifications')
    .update({ read: true })
    .eq('recipient_id', userId)
    .eq('read', false);
}
