// export-my-data (T082, mspec §11 "Your Data"): returns everything the
// platform stores about the calling user as a single JSON document.
// JWT-verified (default verify_jwt) — the user can only export themself;
// reads run with the service role so the bundle is complete even where
// RLS would hide rows from the user (e.g. resolved reports about them are
// NOT included — only data the user authored or that is about their account).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response('misconfigured', { status: 500 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('unauthorized', { status: 401 });

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  const userId = userData?.user?.id;
  if (userError || !userId) return new Response('unauthorized', { status: 401 });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Each section is best-effort: a missing table or RLS surprise must not
  // sink the whole export.
  async function section(name: string, query: PromiseLike<{ data: unknown; error: unknown }>) {
    try {
      const { data, error } = await query;
      return { name, data: error ? { _error: String((error as Error)?.message ?? error) } : data };
    } catch (err) {
      return { name, data: { _error: String(err) } };
    }
  }

  const sections = await Promise.all([
    section('profile', admin.from('profiles').select('*').eq('id', userId).maybeSingle()),
    section('checkins', admin.from('checkins').select('*').eq('user_id', userId)),
    section('reviews', admin.from('reviews').select('*').eq('user_id', userId)),
    section('condition_votes', admin.from('condition_votes').select('*').eq('user_id', userId)),
    section('favorites', admin.from('favorites').select('*').eq('user_id', userId)),
    section('events_organized', admin.from('events').select('*').eq('organizer_id', userId)),
    section('event_participation', admin.from('event_participants').select('*').eq('user_id', userId)),
    section('equipment_history', admin.from('equipment_history').select('*').eq('user_id', userId)),
    section('friendships', admin.from('friendships').select('*').or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)),
    section('notifications', admin.from('notifications').select('*').eq('recipient_id', userId)),
    section('venues_submitted', admin.from('venues').select('*').eq('submitted_by', userId)),
    section('venue_change_requests', admin.from('venue_change_requests').select('*').eq('user_id', userId)),
    section('challenge_submissions', admin.from('challenge_submissions').select('*').eq('user_id', userId)),
    section('badge_awards', admin.from('badge_awards').select('*').eq('user_id', userId)),
    section('reports_filed', admin.from('content_reports').select('*').eq('reporter_id', userId)),
    section('user_feedback', admin.from('user_feedback').select('*').eq('user_id', userId)),
  ]);

  const bundle: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    format_version: 1,
  };
  for (const s of sections) bundle[s.name] = s.data;

  return new Response(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="ttportal-data-export.json"',
    },
  });
});
