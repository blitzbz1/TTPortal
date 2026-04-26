import { supabase } from '../lib/supabase';

type NotificationSender = { id: string; full_name: string | null; avatar_url: string | null };

type NotificationRow = {
  id: number;
  recipient_id: string;
  sender_id: string | null;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
  sender: NotificationSender | null;
};

export async function getNotifications(userId: string, limit = 50) {
  // Single query: embed the sender profile via the notifications→profiles FK
  // added in migration 039.
  return supabase
    .from('notifications')
    .select(
      'id, recipient_id, sender_id, type, title, body, data, read, created_at, ' +
        'sender:profiles!notifications_sender_profiles_fk(id, full_name, avatar_url)',
    )
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<NotificationRow[]>();
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
