// F013: shared, pure forecast-summary logic for the weather-proxy edge
// function. Kept in _shared so `npm run test:functions` covers it (the proxy
// itself is just fetch + cache, like amatur-proxy).

export interface OpenMeteoCurrent {
  time?: string;
  temperature_2m?: number;
  precipitation?: number;
  weather_code?: number;
  wind_speed_10m?: number;
}
export interface OpenMeteoHourly {
  time?: string[];
  precipitation?: number[];
  precipitation_probability?: number[];
}
export interface OpenMeteoResponse {
  current?: OpenMeteoCurrent;
  hourly?: OpenMeteoHourly;
}

export interface WeatherSummary {
  temp_c: number | null;
  wind_kmh: number | null;
  weather_code: number | null;
  raining_now: boolean;
  /** ISO local hour when rain next becomes likely within the window, else null. */
  rain_at: string | null;
  fetched_at: string;
}

const RAIN_NOW_MM = 0.1;
const RAIN_SOON_MM = 0.3;
const RAIN_SOON_PROB = 50;
const SCAN_HOURS = 12;

/**
 * Collapse an Open-Meteo forecast into the compact summary the client renders.
 * ISO time strings are compared lexicographically (Open-Meteo returns local,
 * timezone=auto), so no Date/timezone parsing is needed.
 */
export function summarizeForecast(api: OpenMeteoResponse, fetchedAtIso: string): WeatherSummary {
  const current = api.current ?? {};
  const hourly = api.hourly ?? {};
  const times = hourly.time ?? [];
  const precip = hourly.precipitation ?? [];
  const prob = hourly.precipitation_probability ?? [];

  const rainingNow = (current.precipitation ?? 0) > RAIN_NOW_MM;

  const nowKey = current.time ?? '';
  let startIdx = 0;
  while (startIdx < times.length && times[startIdx] < nowKey) startIdx++;

  let rainAt: string | null = null;
  for (let i = startIdx; i < times.length && i < startIdx + SCAN_HOURS; i++) {
    const willRain = (precip[i] ?? 0) >= RAIN_SOON_MM || (prob[i] ?? 0) >= RAIN_SOON_PROB;
    if (willRain) {
      rainAt = times[i];
      break;
    }
  }

  return {
    temp_c: current.temperature_2m ?? null,
    wind_kmh: current.wind_speed_10m ?? null,
    weather_code: current.weather_code ?? null,
    raining_now: rainingNow,
    rain_at: rainAt,
    fetched_at: fetchedAtIso,
  };
}
