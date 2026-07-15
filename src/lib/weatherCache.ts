// On-device weather cache (F013). Mirrors the server weather_cache: a 30-min
// TTL keyed per ~1km grid cell (the same `toFixed(2)` rounding the weather
// query key and the weather-proxy edge function use), so the map's city banner
// and nearby venue chips share one entry and the network is hit at most once
// per cell per refresh window — even across app launches.
import { cachedLoad, cachedSave, type CacheRead } from './cacheUtils';

const TTL_MS = 30 * 60 * 1000; // matches the weather-proxy CACHE_TTL_MS

// Round to ~1km so nearby coordinates collapse to one key (matches the server).
const key = (lat: number, lng: number) => `weather:${lat.toFixed(2)},${lng.toFixed(2)}`;

export function loadCachedWeather<T>(lat: number, lng: number): CacheRead<T> | null {
  return cachedLoad<T>(key(lat, lng), TTL_MS);
}

export function saveCachedWeather<T>(lat: number, lng: number, data: T): void {
  cachedSave(key(lat, lng), data);
}
