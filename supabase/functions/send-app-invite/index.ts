import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const redirectTo = Deno.env.get('INVITE_REDIRECT_TO') ?? 'ttportal://sign-in';

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse({ error: 'Supabase environment is not configured' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('send-app-invite: missing authorization header');
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const [{ data: userRes, error: userError }, body] = await Promise.all([
      authClient.auth.getUser(),
      req.json(),
    ]);

    if (userError || !userRes.user) {
      console.error('send-app-invite: failed user lookup', { userError });
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const email = String(body?.email ?? '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      console.error('send-app-invite: invalid email', { email });
      return jsonResponse({ error: 'Invalid email address' }, 400);
    }

    const { data: existingProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (profileError) {
      console.error('send-app-invite: failed recipient validation', { profileError, email });
      return jsonResponse({ error: 'Failed to validate invite recipient' }, 500);
    }

    if (existingProfile?.id) {
      console.warn('send-app-invite: user already registered via profile', { email });
      return jsonResponse({ error: 'User already registered', code: 'already_registered' }, 409);
    }

    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        invited_by: userRes.user.id,
      },
    });

    if (error) {
      const message = error.message ?? 'Invite failed';
      const code = /already registered|user already exists/i.test(message)
        ? 'already_registered'
        : (error.code ?? 'invite_failed');
      console.error('send-app-invite: invite failed', { email, code, message });
      return jsonResponse({ error: message, code }, 400);
    }

    console.info('send-app-invite: invite sent', { email, invitedBy: userRes.user.id });
    return jsonResponse({ success: true });
  } catch (error) {
    console.error('send-app-invite: unexpected error', { error });
    return jsonResponse({ error: (error as Error).message, code: 'unexpected_error' }, 500);
  }
});
