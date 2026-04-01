import { supabase } from '../lib/supabase';
import type { EventInsert } from '../types/database';

export async function getEvents(
  filter: 'upcoming' | 'past' | 'mine',
  userId?: string,
) {
  const now = new Date().toISOString();
  let query = supabase
    .from('events')
    .select('*, venues(name, city), event_participants(user_id)');

  if (filter === 'upcoming') {
    query = query.gte('starts_at', now).neq('status', 'cancelled');
  } else if (filter === 'past') {
    query = query.lt('starts_at', now);
    if (userId) query = query.eq('event_participants.user_id', userId);
  } else if (filter === 'mine' && userId) {
    query = query.eq('organizer_id', userId);
  }

  const result = await query.order('starts_at', { ascending: filter === 'upcoming' }).limit(50);
  if (result.error || !result.data?.length) return result;

  // Resolve participant profile names separately (no FK between event_participants and profiles)
  const allUserIds = new Set<string>();
  for (const event of result.data) {
    for (const p of (event as any).event_participants ?? []) {
      allUserIds.add(p.user_id);
    }
  }
  if (allUserIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', Array.from(allUserIds));
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    for (const event of result.data) {
      (event as any).event_participants = ((event as any).event_participants ?? []).map((p: any) => ({
        ...p,
        profiles: profileMap.get(p.user_id) ?? null,
      }));
    }
  }

  return result;
}

export async function getEventParticipants(eventId: number) {
  const { data: participants, error } = await supabase
    .from('event_participants')
    .select('user_id, joined_at')
    .eq('event_id', eventId)
    .order('joined_at', { ascending: true });

  if (error || !participants?.length) return { data: participants ?? [], error };

  const userIds = participants.map((p) => p.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, city')
    .in('id', userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const merged = participants.map((p) => ({
    ...p,
    profiles: profileMap.get(p.user_id) ?? null,
  }));

  return { data: merged, error: null };
}

export async function createEvent(data: EventInsert) {
  return supabase.from('events').insert(data).select().single();
}

export async function joinEvent(eventId: number, userId: string) {
  return supabase
    .from('event_participants')
    .insert({ event_id: eventId, user_id: userId })
    .select()
    .single();
}

export async function leaveEvent(eventId: number, userId: string) {
  return supabase
    .from('event_participants')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);
}

export async function stopRecurrence(eventId: number, organizerId: string) {
  return supabase
    .from('events')
    .update({ recurrence_rule: null, recurrence_day: null })
    .eq('id', eventId)
    .eq('organizer_id', organizerId)
    .select()
    .single();
}

export async function cancelEvent(eventId: number, organizerId: string) {
  return supabase
    .from('events')
    .update({ status: 'cancelled' })
    .eq('id', eventId)
    .eq('organizer_id', organizerId)
    .select()
    .single();
}

export async function sendEventInvites(eventId: number, friendIds: string[], organizerId: string) {
  return supabase.rpc('send_event_invites', {
    p_event_id: eventId,
    p_friend_ids: friendIds,
    p_organizer_id: organizerId,
  });
}

export async function sendEventUpdate(eventId: number, message: string, organizerId: string) {
  return supabase.rpc('send_event_update', {
    p_event_id: eventId,
    p_message: message,
    p_organizer_id: organizerId,
  });
}
