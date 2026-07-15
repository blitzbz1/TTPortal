// GDPR data export client (T082): calls the export-my-data Edge Function
// with the caller's JWT and hands the JSON to the platform share/download
// surface. No new native deps — Share covers iOS/Android, a Blob link
// covers web.

import { Platform, Share } from 'react-native';
import { supabase } from './supabase';

export async function downloadMyData(): Promise<{ error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { error: 'not_signed_in' };

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!url) return { error: 'misconfigured' };

  let json: string;
  try {
    const res = await fetch(`${url}/functions/v1/export-my-data`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { error: `export_failed_${res.status}` };
    json = await res.text();
  } catch {
    return { error: 'network' };
  }

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = 'ttportal-data-export.json';
    a.click();
    URL.revokeObjectURL(href);
    return { error: null };
  }

  try {
    await Share.share({ message: json, title: 'ttportal-data-export.json' });
    return { error: null };
  } catch {
    return { error: 'share_failed' };
  }
}
