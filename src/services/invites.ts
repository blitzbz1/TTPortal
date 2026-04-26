import { supabase } from '../lib/supabase';

export async function sendAppInviteEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return supabase.functions.invoke('send-app-invite', {
    body: { email: normalizedEmail },
  });
}
