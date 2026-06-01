import { supabase } from '../lib/supabase';
import { invalidateFriendsCache, invalidatePendingCache } from '../lib/friendsCache';

type FriendProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  username: string | null;
};

type FriendshipRow = {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  requester: FriendProfile | null;
  addressee: FriendProfile | null;
};

type PendingRequestRow = {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  requester: Pick<FriendProfile, 'id' | 'full_name' | 'avatar_url'> | null;
};

export async function sendRequest(requesterId: string, addresseeId: string) {
  const result = await supabase
    .from('friendships')
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' })
    .select()
    .single();
  if (!result.error) {
    // Pending list changes for both sides; sender sees nothing new in their
    // pending tab but the addressee does on next visit.
    invalidatePendingCache(addresseeId);
  }
  return result;
}

export async function acceptRequest(id: number, userId: string) {
  const result = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', id)
    .eq('addressee_id', userId)
    .select()
    .single();
  if (!result.error) {
    invalidatePendingCache(userId);
    invalidateFriendsCache(userId);
    // The other side's friend list also changed.
    if (result.data?.requester_id) invalidateFriendsCache(result.data.requester_id);
  }
  return result;
}

export async function declineRequest(id: number, userId: string) {
  const result = await supabase
    .from('friendships')
    .update({ status: 'declined' })
    .eq('id', id)
    .eq('addressee_id', userId)
    .select()
    .single();
  if (!result.error) invalidatePendingCache(userId);
  return result;
}

export async function getFriends(userId: string) {
  // Single query: embed both endpoints' profiles via the friendships→profiles FKs
  // added in migration 038. The disambiguator `!fk_name` is required because two
  // FK paths from friendships to profiles exist (requester_id, addressee_id).
  // Cast: supabase TS inference can't statically parse multi-FK aliased embeds.
  return supabase
    .from('friendships')
    .select(
      'id, requester_id, addressee_id, status, created_at, ' +
        'requester:profiles!friendships_requester_profiles_fk(id, full_name, avatar_url, city, username), ' +
        'addressee:profiles!friendships_addressee_profiles_fk(id, full_name, avatar_url, city, username)',
    )
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .returns<FriendshipRow[]>();
}

export async function getPendingRequests(userId: string) {
  return supabase
    .from('friendships')
    .select(
      'id, requester_id, addressee_id, status, created_at, ' +
        'requester:profiles!friendships_requester_profiles_fk(id, full_name, avatar_url)',
    )
    .eq('addressee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .returns<PendingRequestRow[]>();
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

export async function findUserByUsername(username: string) {
  const normalized = username.trim().replace(/^@+/, '').toLowerCase();
  if (normalized.length < 3) return { data: null, error: null };

  return supabase
    .from('profiles')
    .select('id, full_name, avatar_url, city, username')
    .eq('username', normalized)
    .maybeSingle();
}

export async function getFriendshipBetweenUsers(userId: string, otherUserId: string) {
  return supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${userId})`,
    )
    .maybeSingle();
}
