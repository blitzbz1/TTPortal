// F013: client weather service. Calls the weather-proxy edge function (which
// proxies Open-Meteo and caches server-side ~30 min). Same invocation pattern
// as services/amatur.ts (apikey + anon Bearer).

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Mirror of the edge function's WeatherSummary (supabase/functions/_shared/weather.ts). */
export interface WeatherSummary {
  temp_c: number | null;
  wind_kmh: number | null;
  weather_code: number | null;
  raining_now: boolean;
  rain_at: string | null;
  fetched_at: string;
}

export async function getWeather(
  lat: number,
  lng: number,
): Promise<{ data: WeatherSummary | null; error: string | null }> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/weather-proxy?lat=${lat}&lng=${lng}`,
      {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
      },
    );
    if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
    const data = await res.json();
    if (data?.error) return { data: null, error: String(data.error) };
    return { data: data as WeatherSummary, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'network error' };
  }
}
