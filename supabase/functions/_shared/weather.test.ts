// Local deno tests for the shared weather forecast summary (F013).
// Run with: deno test supabase/functions/_shared/

import { summarizeForecast, type OpenMeteoResponse } from './weather.ts';

const FETCHED = '2026-06-13T12:00';

function base(): OpenMeteoResponse {
  return {
    current: { time: '2026-06-13T12:00', temperature_2m: 18, precipitation: 0, weather_code: 1, wind_speed_10m: 10 },
    hourly: {
      time: ['2026-06-13T11:00', '2026-06-13T12:00', '2026-06-13T13:00', '2026-06-13T14:00', '2026-06-13T15:00'],
      temperature_2m: [16, 18, 19, 20, 19],
      precipitation: [0, 0, 0, 0, 0],
      precipitation_probability: [0, 0, 0, 0, 0],
      weather_code: [3, 1, 0, 2, 61],
      wind_speed_10m: [8, 10, 12, 14, 16],
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
  if (!Array.isArray(s.hourly) || s.hourly.length !== 0) throw new Error('empty payload should yield empty hourly');
  if (s.fetched_at !== FETCHED) throw new Error('fetched_at not passed through');
});

Deno.test('builds the next-hours forecast starting at the current hour', () => {
  const s = summarizeForecast(base(), FETCHED);
  // now = 12:00, so the strip starts there (the 11:00 past hour is dropped).
  if (s.hourly.length !== 4) throw new Error(`expected 4 upcoming hours, got ${s.hourly.length}`);
  if (s.hourly[0].time !== '2026-06-13T12:00') throw new Error(`first hour: ${s.hourly[0].time}`);
  if (s.hourly[0].temp_c !== 18) throw new Error(`first temp: ${s.hourly[0].temp_c}`);
  if (s.hourly[0].weather_code !== 1) throw new Error(`first code: ${s.hourly[0].weather_code}`);
  if (s.hourly[0].wind_kmh !== 10) throw new Error(`first wind: ${s.hourly[0].wind_kmh}`);
  // carries the later hours too (14:00 wind 14, 15:00 code 61).
  if (s.hourly[3].weather_code !== 61) throw new Error(`last code: ${s.hourly[3].weather_code}`);
});

Deno.test('caps the forecast at FORECAST_HOURS (8)', () => {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) times.push(`2026-06-13T${String(h).padStart(2, '0')}:00`);
  const s = summarizeForecast({
    current: { time: '2026-06-13T00:00', temperature_2m: 10, wind_speed_10m: 5, weather_code: 0 },
    hourly: {
      time: times,
      temperature_2m: times.map(() => 10),
      precipitation: times.map(() => 0),
      precipitation_probability: times.map(() => 0),
      weather_code: times.map(() => 0),
      wind_speed_10m: times.map(() => 5),
    },
  }, FETCHED);
  if (s.hourly.length !== 8) throw new Error(`expected 8 (capped), got ${s.hourly.length}`);
});
