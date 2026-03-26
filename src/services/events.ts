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
  } else if (filter === 'mine' && userId) {
    query = query.eq('organizer_id', userId);
  }

  return query.order('starts_at', { ascending: filter === 'upcoming' });
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
