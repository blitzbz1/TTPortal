import { supabase } from '../lib/supabase';

export async function getNotifications(userId: string, limit = 50) {
  return supabase
    .from('notifications')
    .select('*, sender:profiles!sender_id(full_name, avatar_url)')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
}

export async function getUnreadCount(userId: string) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('read', false);

  return { data: count ?? 0, error };
}

export async function markAsRead(notificationId: number) {
  return supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
}

export async function markAllAsRead(userId: string) {
  return supabase
    .from('notifications')
    .update({ read: true })
    .eq('recipient_id', userId)
    .eq('read', false);
}
