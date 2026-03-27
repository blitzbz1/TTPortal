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

  return query.order('starts_at', { ascending: filter === 'upcoming' });
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
