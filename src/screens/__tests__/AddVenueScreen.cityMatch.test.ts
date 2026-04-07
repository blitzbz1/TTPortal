import { normalize, extractNominatimCity, matchCity } from '../AddVenueScreen';

describe('AddVenueScreen — city matching', () => {
  describe('normalize', () => {
    it('lowercases text', () => {
      expect(normalize('București')).toBe('bucuresti');
    });

    it('strips Romanian diacritics (ă, â, î, ș, ț)', () => {
      expect(normalize('Ăâîșț')).toBe('aaist');
    });

    it('strips combined diacritics (uppercase + accents)', () => {
      expect(normalize('BUCUREȘTI')).toBe('bucuresti');
    });

    it('leaves plain ASCII unchanged', () => {
      expect(normalize('Brasov')).toBe('brasov');
    });

    it('handles empty string', () => {
      expect(normalize('')).toBe('');
    });
  });

  describe('extractNominatimCity', () => {
    it('returns city when present', () => {
      expect(extractNominatimCity({ city: 'București' })).toBe('București');
    });

    it('falls back to town', () => {
      expect(extractNominatimCity({ town: 'Sinaia' })).toBe('Sinaia');
    });

    it('falls back to village', () => {
      expect(extractNominatimCity({ village: 'Bran' })).toBe('Bran');
    });

    it('falls back to municipality', () => {
      expect(extractNominatimCity({ municipality: 'Ploiești' })).toBe('Ploiești');
    });

    it('prefers city over town/village/municipality', () => {
      expect(extractNominatimCity({ city: 'Cluj-Napoca', town: 'Florești', village: 'X' })).toBe('Cluj-Napoca');
    });

    it('returns null for undefined address', () => {
      expect(extractNominatimCity(undefined)).toBeNull();
    });

    it('returns null for empty address object', () => {
      expect(extractNominatimCity({})).toBeNull();
    });
  });

  describe('matchCity', () => {
    const knownCities = ['București', 'Cluj-Napoca', 'Brașov', 'Timișoara', 'Iași', 'Constanța'];

    it('matches exact city name', () => {
      expect(matchCity('București', knownCities)).toBe('București');
    });

    it('matches without diacritics', () => {
      expect(matchCity('Bucuresti', knownCities)).toBe('București');
    });

    it('matches case-insensitively', () => {
      expect(matchCity('BUCURESTI', knownCities)).toBe('București');
      expect(matchCity('bucuresti', knownCities)).toBe('București');
    });

    it('matches Brașov without diacritics', () => {
      expect(matchCity('Brasov', knownCities)).toBe('Brașov');
    });

    it('matches Timișoara without diacritics', () => {
      expect(matchCity('Timisoara', knownCities)).toBe('Timișoara');
    });

    it('matches Iași without diacritics', () => {
      expect(matchCity('Iasi', knownCities)).toBe('Iași');
    });

    it('matches Cluj-Napoca case-insensitively', () => {
      expect(matchCity('cluj-napoca', knownCities)).toBe('Cluj-Napoca');
    });

    it('returns null for unknown city', () => {
      expect(matchCity('Sibiu', knownCities)).toBeNull();
    });

    it('returns null for empty known cities list', () => {
      expect(matchCity('București', [])).toBeNull();
    });
  });
});
