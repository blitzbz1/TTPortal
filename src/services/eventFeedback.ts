import { supabase } from '../lib/supabase';
import type { EventFeedbackInsert } from '../types/database';

export async function createEventFeedback(data: EventFeedbackInsert) {
  return supabase.from('event_feedback').insert(data).select().single();
}

export async function getEventFeedback(eventId: number) {
  return supabase
    .from('event_feedback')
    .select('id, event_id, user_id, reviewer_name, rating, body, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
}

export async function getUserEventFeedback(eventId: number, userId: string) {
  return supabase
    .from('event_feedback')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
}

// Single round trip for "which of these events has the user already given feedback on?"
// Replaces a Promise.all of N maybeSingle() calls (one per event) on the past tab.
export async function getUserEventFeedbackForEvents(
  userId: string,
  eventIds: number[],
): Promise<{ data: number[]; error: unknown }> {
  if (!eventIds.length) return { data: [], error: null };
  const { data, error } = await supabase
    .from('event_feedback')
    .select('event_id')
    .eq('user_id', userId)
    .in('event_id', eventIds);
  if (error) return { data: [], error };
  return { data: (data ?? []).map((r: { event_id: number }) => r.event_id), error: null };
}
