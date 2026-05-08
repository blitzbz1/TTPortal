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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('PASSWORD_CHANGED_FROM') ?? '"TTPortal" <auth@ttportal.org>';
    const supportEmail = Deno.env.get('SUPPORT_EMAIL') ?? 'ttportal.info@gmail.com';

    if (!supabaseUrl || !supabaseAnonKey || !resendApiKey) {
      return jsonResponse({ error: 'Email environment is not configured', code: 'missing_env' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('send-password-changed-email: missing authorization header');
      return jsonResponse({ error: 'Unauthorized', code: 'unauthorized' }, 401);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes, error: userError } = await authClient.auth.getUser();
    const email = userRes.user?.email;

    if (userError || !userRes.user || !email) {
      console.error('send-password-changed-email: failed user lookup', { userError });
      return jsonResponse({ error: 'Unauthorized', code: 'unauthorized' }, 401);
    }

    const safeSupportEmail = escapeHtml(supportEmail);
    const html = `
      <h2>Your TTPortal password was changed</h2>
      <p>Your TTPortal password was changed successfully.</p>
      <p>If this was you, no action is needed.</p>
      <p>If you did not make this change, reset your password immediately and contact support at <a href="mailto:${safeSupportEmail}">${safeSupportEmail}</a>.</p>
    `;
    const text = [
      'Your TTPortal password was changed',
      '',
      'Your TTPortal password was changed successfully.',
      '',
      'If this was you, no action is needed.',
      '',
      `If you did not make this change, reset your password immediately and contact support at ${supportEmail}.`,
    ].join('\n');

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: 'Your TTPortal password was changed',
        html,
        text,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('send-password-changed-email: resend failed', {
        status: resendResponse.status,
        error: errorText,
      });
      return jsonResponse({ error: 'Email failed', code: 'email_failed' }, 500);
    }

    console.info('send-password-changed-email: email sent', { userId: userRes.user.id });
    return jsonResponse({ success: true });
  } catch (error) {
    console.error('send-password-changed-email: unexpected error', { error });
    return jsonResponse({ error: (error as Error).message, code: 'unexpected_error' }, 500);
  }
});
