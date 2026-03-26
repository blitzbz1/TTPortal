import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

export async function getProfile(userId: string) {
  return supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
}

export async function updateProfile(
  userId: string,
  data: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'city' | 'lang' | 'username'>>,
) {
  return supabase
    .from('profiles')
    .update(data)
    .eq('id', userId)
    .select()
    .single();
}

export async function getProfileStats(userId: string) {
  return supabase
    .from('leaderboard_checkins')
    .select('total_checkins, unique_venues')
    .eq('user_id', userId)
    .single();
}
