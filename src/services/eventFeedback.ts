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
