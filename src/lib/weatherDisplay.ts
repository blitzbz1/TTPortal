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
