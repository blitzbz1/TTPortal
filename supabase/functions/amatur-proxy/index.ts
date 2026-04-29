import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CACHE_TABLE = 'amatur_cache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const WF_URL = 'https://www.amatur.ro/tenisdemasa/w_f.php';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Check cache
    const { data: cached } = await supabase
      .from(CACHE_TABLE)
      .select('html, fetched_at')
      .eq('id', 'programate')
      .single();

    if (cached?.html && cached?.fetched_at) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < CACHE_TTL_MS) {
        return new Response(cached.html, {
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8', 'X-Cache': 'HIT' },
        });
      }
    }

    // Fetch fresh data from amatur.ro
    const body = new URLSearchParams({
      turnee: '1',
      limit: '100',
      start: '0',
      select: '1 and cls=0 ORDER by cls=0 desc, case when cls>0 then data end desc, case when cls>0 then ID end desc, case when cls=0 then data end asc, case when cls=0 then ID end asc ',
    });

    const response = await fetch(WF_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      // Return stale cache if available
      if (cached?.html) {
        return new Response(cached.html, {
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8', 'X-Cache': 'STALE' },
        });
      }
      return new Response(JSON.stringify({ error: `Upstream HTTP ${response.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = await response.text();

    // Upsert cache
    await supabase
      .from(CACHE_TABLE)
      .upsert({ id: 'programate', html, fetched_at: new Date().toISOString() });

    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8', 'X-Cache': 'MISS' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
