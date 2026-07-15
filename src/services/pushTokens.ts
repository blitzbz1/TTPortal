import { supabase } from '../lib/supabase';

export async function upsertPushToken(userId: string, token: string, deviceType: 'ios' | 'android') {
  return supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, token, device_type: deviceType, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' },
    );
}

export async function deletePushToken(userId: string, token: string) {
  return supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);
}
