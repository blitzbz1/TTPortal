// Local deno tests for the shared weather forecast summary (F013).
// Run with: deno test supabase/functions/_shared/

import { summarizeForecast, type OpenMeteoResponse } from './weather.ts';

const FETCHED = '2026-06-13T12:00';

function base(): OpenMeteoResponse {
  return {
    current: { time: '2026-06-13T12:00', temperature_2m: 18, precipitation: 0, weather_code: 1, wind_speed_10m: 10 },
    hourly: {
      time: ['2026-06-13T11:00', '2026-06-13T12:00', '2026-06-13T13:00', '2026-06-13T14:00', '2026-06-13T15:00'],
      precipitation: [0, 0, 0, 0, 0],
      precipitation_probability: [0, 0, 0, 0, 0],
    },
  };
}

Deno.test('dry forecast reports no rain_at and not raining', () => {
  const s = summarizeForecast(base(), FETCHED);
  if (s.raining_now) throw new Error('should not be raining');
  if (s.rain_at !== null) throw new Error(`expected null rain_at, got ${s.rain_at}`);
  if (s.temp_c !== 18) throw new Error(`temp: ${s.temp_c}`);
  if (s.wind_kmh !== 10) throw new Error(`wind: ${s.wind_kmh}`);
});

Deno.test('detects rain starting later by precipitation amount', () => {
  const api = base();
  api.hourly!.precipitation = [0, 0, 0, 1.2, 0]; // 14:00
  const s = summarizeForecast(api, FETCHED);
  if (s.rain_at !== '2026-06-13T14:00') throw new Error(`rain_at: ${s.rain_at}`);
  if (s.raining_now) throw new Error('should not be raining now');
});

Deno.test('detects rain by probability even with zero precip', () => {
  const api = base();
  api.hourly!.precipitation_probability = [0, 0, 70, 0, 0]; // 13:00
  const s = summarizeForecast(api, FETCHED);
  if (s.rain_at !== '2026-06-13T13:00') throw new Error(`rain_at: ${s.rain_at}`);
});

Deno.test('ignores past hours before the current time', () => {
  const api = base();
  // Heavy rain at 11:00 (the past) must be ignored; 12:00+ is dry.
  api.hourly!.precipitation = [5, 0, 0, 0, 0];
  const s = summarizeForecast(api, FETCHED);
  if (s.rain_at !== null) throw new Error(`should ignore past rain, got ${s.rain_at}`);
});

Deno.test('flags raining_now from current precipitation', () => {
  const api = base();
  api.current!.precipitation = 0.8;
  const s = summarizeForecast(api, FETCHED);
  if (!s.raining_now) throw new Error('should be raining now');
});

Deno.test('handles a missing/empty payload without throwing', () => {
  const s = summarizeForecast({}, FETCHED);
  if (s.temp_c !== null || s.rain_at !== null || s.raining_now) {
    throw new Error('empty payload should yield nulls/false');
  }
  if (s.fetched_at !== FETCHED) throw new Error('fetched_at not passed through');
});
