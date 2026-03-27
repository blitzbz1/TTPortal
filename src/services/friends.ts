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
  const { data: friendships, error } = await supabase
    .from('friendships')
    .select('*')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (error || !friendships?.length) return { data: friendships ?? [], error };

  const userIds = new Set<string>();
  for (const f of friendships) {
    userIds.add(f.requester_id);
    userIds.add(f.addressee_id);
  }
  userIds.delete(userId);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, city, username')
    .in('id', [...userIds]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const merged = friendships.map((f) => ({
    ...f,
    requester: profileMap.get(f.requester_id) ?? null,
    addressee: profileMap.get(f.addressee_id) ?? null,
  }));

  return { data: merged, error: null };
}

export async function getPendingRequests(userId: string) {
  const { data: pending, error } = await supabase
    .from('friendships')
    .select('*')
    .eq('addressee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !pending?.length) return { data: pending ?? [], error };

  const requesterIds = pending.map((p) => p.requester_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', requesterIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const merged = pending.map((p) => ({
    ...p,
    requester: profileMap.get(p.requester_id) ?? null,
  }));

  return { data: merged, error: null };
}

export async function getFriendIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (!data?.length) return [];
  return data.map((f) => f.requester_id === userId ? f.addressee_id : f.requester_id);
}

export async function searchUsers(query: string) {
  return supabase
    .from('profiles')
    .select('id, full_name, avatar_url, city')
    .or(`full_name.ilike.%${query}%,username.ilike.%${query}%`)
    .limit(20);
}
