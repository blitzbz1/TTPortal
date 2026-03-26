import { supabase } from '../lib/supabase';

export async function sendRequest(requesterId: string, addresseeId: string) {
  return supabase
    .from('friendships')
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' })
    .select()
    .single();
}

export async function acceptRequest(id: number) {
  return supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', id)
    .select()
    .single();
}

export async function declineRequest(id: number) {
  return supabase
    .from('friendships')
    .update({ status: 'declined' })
    .eq('id', id)
    .select()
    .single();
}

export async function getFriends(userId: string) {
  return supabase
    .from('friendships')
    .select('*, requester:profiles!requester_id(*), addressee:profiles!addressee_id(*)')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
}

export async function getPendingRequests(userId: string) {
  return supabase
    .from('friendships')
    .select('*, requester:profiles!requester_id(id, full_name, avatar_url)')
    .eq('addressee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
}

export async function searchUsers(query: string) {
  return supabase
    .from('profiles')
    .select('id, full_name, avatar_url, city')
    .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
    .limit(20);
}
