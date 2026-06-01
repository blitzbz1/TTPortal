import { withTiming } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const startedAt = new Date().toISOString();
const version = Deno.env.get('SUPABASE_FUNCTION_VERSION') ?? 'local';

Deno.serve(withTiming('healthz', async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ ok: true, ts: Date.now(), version, started_at: startedAt }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}));
