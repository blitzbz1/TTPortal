import { supabase } from '../lib/supabase';
import type { EventInsert } from '../types/database';
import { invalidatePlayHistoryCache } from '../lib/playHistoryCache';
import { invalidateProfileStatsCache } from '../lib/profileCache';

export async function getEvents(
  filter: 'upcoming' | 'past' | 'mine',
  userId?: string,
  options: { limit?: number; offset?: number } = {},
) {
  const { limit = 50, offset = 0 } = options;
  const now = new Date().toISOString();
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
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
    // "Upcoming" = anything that hasn't ended yet:
    //   - future events                   (starts_at >= now)
    //   - in-progress with explicit end   (ends_at >= now)
    //   - in-progress without end, recent (ends_at IS NULL AND starts_at >= now - 4h)
    // In-progress events surface here so they don't slip between tabs.
    query = query
      .or(`starts_at.gte.${now},ends_at.gte.${now},and(ends_at.is.null,starts_at.gte.${fourHoursAgo})`)
      .not('status', 'in', '(cancelled,completed)');
  } else if (filter === 'past') {
    // Complement of upcoming: events that have actually ended.
    //   - ended explicitly  (ends_at < now)
    //   - no end, started > 4h ago
    query = query.or(`ends_at.lt.${now},and(ends_at.is.null,starts_at.lt.${fourHoursAgo})`);
    if (userId) query = query.eq('ep_filter.user_id', userId);
  } else if (filter === 'mine' && userId) {
    query = query.eq('organizer_id', userId);
  }

  return query
    .order('starts_at', { ascending: filter === 'upcoming' })
    .range(offset, offset + limit - 1);
}

export const PAST_EVENTS_PAGE_SIZE = 20;

export async function getUpcomingEventsByVenue(venueId: number) {
  const now = new Date().toISOString();
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  // Match anything that hasn't ended yet:
  //   - future events                            (starts_at >= now)
  //   - in-progress with explicit end            (ends_at >= now)
  //   - in-progress without end, recent start    (ends_at IS NULL AND starts_at >= now - 4h)
  // Sorted ascending by starts_at so currently running events surface
  // first, followed by upcoming ones.
  return supabase
    .from('events')
    .select(
      '*, venues(name, city, lat, lng), event_participants(user_id, hours_played, profiles!event_participants_user_profiles_fk(id, full_name))',
    )
    .eq('venue_id', venueId)
    .or(`starts_at.gte.${now},ends_at.gte.${now},and(ends_at.is.null,starts_at.gte.${fourHoursAgo})`)
    .not('status', 'in', '(cancelled,completed)')
    .order('starts_at', { ascending: true })
    .limit(50);
}

/**
 * Lightweight count-only variant of getUpcomingEventsByVenue. The venue
 * detail screen only needs the number to render a badge, not the full
 * event rows + participant joins. `head: true` returns just the count
 * without shipping any rows.
 */
export async function getUpcomingEventCountByVenue(venueId: number) {
  const now = new Date().toISOString();
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('venue_id', venueId)
    .or(`starts_at.gte.${now},ends_at.gte.${now},and(ends_at.is.null,starts_at.gte.${fourHoursAgo})`)
    .not('status', 'in', '(cancelled,completed)');
  return { data: count ?? 0, error };
}

export async function getEventById(eventId: number) {
  return supabase
    .from('events')
    .select('*, venues(name, city, lat, lng), event_participants(user_id, hours_played)')
    .eq('id', eventId)
    .maybeSingle();
}

export type ActiveFriendEventRow = {
  id: number;
  title: string | null;
  venue_id: number | null;
  starts_at: string;
  ends_at: string | null;
  status: string;
  event_participants: {
    user_id: string;
    profiles: { full_name: string | null; avatar_url: string | null } | null;
  }[];
};

/**
 * Events that are *currently in progress* and have at least one of `friendIds`
 * as a participant. Used by the map to surface a friend-presence badge on
 * venue markers when friends are at an event there (mirrors the live-checkin
 * badge behavior).
 *
 * "In progress" =
 *   - `starts_at <= now()` AND
 *   - (`ends_at >= now()` OR (`ends_at IS NULL` AND `starts_at >= now() - 4h`))
 *   - status not in (cancelled, completed)
 *
 * The 4-hour fallback for null `ends_at` matters: many historical events
 * have no end time stored, and treating them as forever-in-progress would
 * light up the friend-presence badge on every venue where a friend ever
 * participated in an event.
 */
export async function getActiveFriendEvents(friendIds: string[]) {
  if (!friendIds.length) return { data: [] as ActiveFriendEventRow[], error: null };
  const now = new Date().toISOString();
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  // `event_participants!inner` filters events down to ones with a matching
  // friend; the embed is restricted to those friend rows by the same
  // .in('event_participants.user_id', ...) clause below, which is exactly
  // what we want to read on the client.
  return supabase
    .from('events')
    .select(
      'id, title, venue_id, starts_at, ends_at, status, ' +
        'event_participants!inner(user_id, profiles!event_participants_user_profiles_fk(full_name, avatar_url))',
    )
    .lte('starts_at', now)
    .or(`ends_at.gte.${now},and(ends_at.is.null,starts_at.gte.${fourHoursAgo})`)
    .not('status', 'in', '(cancelled,completed)')
    .in('event_participants.user_id', friendIds)
    .returns<ActiveFriendEventRow[]>();
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
