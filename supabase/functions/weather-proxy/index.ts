// F013: weather-proxy — fetches Open-Meteo (free, keyless), summarizes the
// forecast, and caches per rounded lat/lng (~30-min TTL). Mirrors amatur-proxy.
// Query: /weather-proxy?lat=44.43&lng=26.10
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withTiming } from '../_shared/logger.ts';
import { summarizeForecast, type WeatherSummary } from '../_shared/weather.ts';

const CACHE_TABLE = 'weather_cache';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}

Deno.serve(withTiming('weather-proxy', async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ error: 'lat and lng are required' }, 400);
  }
  // Round to ~1km so nearby venues share a cache entry.
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: cached } = await supabase
      .from(CACHE_TABLE)
      .select('weather_data, fetched_at')
      .eq('id', key)
      .single();

    if (cached?.weather_data && cached?.fetched_at) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < CACHE_TTL_MS) {
        return json(cached.weather_data, 200, { 'X-Cache': 'HIT' });
      }
    }

    const apiUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
      `&current=temperature_2m,precipitation,weather_code,wind_speed_10m` +
      `&hourly=precipitation,precipitation_probability&forecast_days=1&timezone=auto`;

    const upstream = await fetch(apiUrl);
    if (!upstream.ok) {
      if (cached?.weather_data) return json(cached.weather_data, 200, { 'X-Cache': 'STALE' });
      return json({ error: `Upstream HTTP ${upstream.status}` }, 502);
    }

    const apiJson = await upstream.json();
    const summary: WeatherSummary = summarizeForecast(apiJson, new Date().toISOString());

    await supabase
      .from(CACHE_TABLE)
      .upsert({ id: key, weather_data: summary, fetched_at: new Date().toISOString() });

    return json(summary, 200, { 'X-Cache': 'MISS' });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
}));
