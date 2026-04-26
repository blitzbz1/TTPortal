import { supabase } from '../lib/supabase';
import type { EventInsert } from '../types/database';
import { invalidatePlayHistoryCache } from '../lib/playHistoryCache';
import { invalidateProfileStatsCache } from '../lib/profileCache';

export async function getEvents(
  filter: 'upcoming' | 'past' | 'mine',
  userId?: string,
) {
  const now = new Date().toISOString();
  const needsParticipantFilter = filter === 'past' && !!userId;
  // Profiles embedded via event_participants_user_profiles_fk (migration 038)
  // — single round trip, no manual merge.
  const participantsEmbed =
    'event_participants(user_id, hours_played, profiles!event_participants_user_profiles_fk(id, full_name))';
  let query = supabase
    .from('events')
    .select(
      needsParticipantFilter
        ? `*, venues(name, city, lat, lng), ${participantsEmbed}, ep_filter:event_participants!inner(user_id)`
        : `*, venues(name, city, lat, lng), ${participantsEmbed}`,
    );

  if (filter === 'upcoming') {
    query = query.gte('starts_at', now).not('status', 'in', '(cancelled,completed)');
  } else if (filter === 'past') {
    query = query.lt('starts_at', now);
    if (userId) query = query.eq('ep_filter.user_id', userId);
  } else if (filter === 'mine' && userId) {
    query = query.eq('organizer_id', userId);
  }

  return query.order('starts_at', { ascending: filter === 'upcoming' }).limit(50);
}

export async function getUpcomingEventsByVenue(venueId: number) {
  const now = new Date().toISOString();
  return supabase
    .from('events')
    .select(
      '*, venues(name, city, lat, lng), event_participants(user_id, hours_played, profiles!event_participants_user_profiles_fk(id, full_name))',
    )
    .eq('venue_id', venueId)
    .gte('starts_at', now)
    .not('status', 'in', '(cancelled,completed)')
    .order('starts_at', { ascending: true })
    .limit(50);
}

export async function getEventById(eventId: number) {
  return supabase
    .from('events')
    .select('*, venues(name, city, lat, lng), event_participants(user_id, hours_played)')
    .eq('id', eventId)
    .maybeSingle();
}

export async function getEventParticipants(eventId: number) {
  return supabase
    .from('event_participants')
    .select(
      'user_id, joined_at, profiles!event_participants_user_profiles_fk(id, full_name, avatar_url, city)',
    )
    .eq('event_id', eventId)
    .order('joined_at', { ascending: true });
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

export async function logEventHours(eventId: number, userId: string, hours: number) {
  const result = await supabase
    .from('event_participants')
    .upsert(
      { event_id: eventId, user_id: userId, hours_played: hours },
      { onConflict: 'event_id,user_id' },
    )
    .select()
    .single();
  if (!result.error) {
    invalidatePlayHistoryCache(userId);
    invalidateProfileStatsCache(userId);
  }
  return result;
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

export async function closeEvent(eventId: number, organizerId: string) {
  return supabase
    .from('events')
    .update({ status: 'completed', ends_at: new Date().toISOString() })
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
