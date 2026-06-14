import { rainHourLabel, isWindy, isRainImminent, WIND_WARN_KMH } from '../weatherDisplay';

describe('weatherDisplay (F013)', () => {
  describe('rainHourLabel', () => {
    it('extracts HH:MM from an ISO local time', () => {
      expect(rainHourLabel('2026-06-13T17:00')).toBe('17:00');
      expect(rainHourLabel('2026-06-13T08:30')).toBe('08:30');
    });
    it('returns null for null/garbage', () => {
      expect(rainHourLabel(null)).toBeNull();
      expect(rainHourLabel(undefined)).toBeNull();
      expect(rainHourLabel('not-a-date')).toBeNull();
    });
  });

  describe('isWindy', () => {
    it('flags winds above the threshold only', () => {
      expect(isWindy(WIND_WARN_KMH + 1)).toBe(true);
      expect(isWindy(WIND_WARN_KMH)).toBe(false);
      expect(isWindy(10)).toBe(false);
      expect(isWindy(null)).toBe(false);
    });
  });

  describe('isRainImminent', () => {
    it('is true when raining now or rain is forecast', () => {
      expect(isRainImminent({ raining_now: true })).toBe(true);
      expect(isRainImminent({ rain_at: '2026-06-13T17:00' })).toBe(true);
    });
    it('is false when dry / missing', () => {
      expect(isRainImminent({ raining_now: false, rain_at: null })).toBe(false);
      expect(isRainImminent(null)).toBe(false);
      expect(isRainImminent(undefined)).toBe(false);
    });
  });
});
