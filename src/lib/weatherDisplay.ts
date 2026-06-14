// F013: pure display helpers for the weather chip/banner (unit-testable).

export const WIND_WARN_KMH = 25;

/** "2026-06-13T17:00" -> "17:00"; null/garbage -> null. */
export function rainHourLabel(rainAt: string | null | undefined): string | null {
  if (!rainAt) return null;
  const m = rainAt.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : null;
}

export function isWindy(windKmh: number | null | undefined): boolean {
  return windKmh != null && windKmh > WIND_WARN_KMH;
}

/** Whether the map should offer the "rain expected — go indoors?" banner. */
export function isRainImminent(s: { raining_now?: boolean; rain_at?: string | null } | null | undefined): boolean {
  if (!s) return false;
  return !!s.raining_now || !!s.rain_at;
}

/**
 * Map an Open-Meteo WMO weather_code to a Lucide icon name. Coarse buckets
 * (clear / partly-cloudy / cloudy / drizzle / rain / snow / thunder) keep the
 * icon set small.
 */
export function weatherCodeIcon(code: number | null | undefined): string {
  if (code == null) return 'cloud';
  if (code === 0) return 'sun';
  if (code === 1 || code === 2) return 'cloud-sun';
  if (code === 3 || code === 45 || code === 48) return 'cloud';
  if (code >= 51 && code <= 57) return 'cloud-drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'cloud-rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'cloud-snow';
  if (code >= 95) return 'cloud-lightning';
  return 'cloud';
}

/** True for codes that mean precipitation (drizzle/rain/snow/showers/thunder). */
export function weatherCodeIsWet(code: number | null | undefined): boolean {
  if (code == null) return false;
  return code >= 51;
}
