import {
  normalize,
  extractNominatimCity,
  matchCity,
  buildNominatimAddress,
  getCitySuggestionName,
  isLikelyCitySuggestion,
  orderCitySuggestions,
} from '../AddVenueScreen';

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

    it('maps English exonym "Bucharest" to Romanian "București"', () => {
      expect(matchCity('Bucharest', knownCities)).toBe('București');
    });

    it('is case-insensitive for the alias lookup', () => {
      expect(matchCity('BUCHAREST', knownCities)).toBe('București');
    });

    it('maps English exonym "Jassy" to Romanian "Iași"', () => {
      expect(matchCity('Jassy', knownCities)).toBe('Iași');
    });

    it('returns null when the alias target is not in knownCities', () => {
      // Cluj-Napoca removed from the fixture so "Klausenburg" has no target
      const withoutCluj = knownCities.filter((c) => c !== 'Cluj-Napoca');
      expect(matchCity('Klausenburg', withoutCluj)).toBeNull();
    });

    it('direct match wins over alias lookup', () => {
      // A city whose normalized name equals the key of an alias shouldn't
      // be redirected when already present directly.
      expect(matchCity('București', knownCities)).toBe('București');
    });
  });

  describe('city suggestions', () => {
    it('accepts capital/admin boundary results that expose only name metadata', () => {
      const suggestion = {
        name: 'Singapore',
        display_name: 'Singapore',
        lat: '1.28967',
        lon: '103.85007',
        class: 'boundary',
        type: 'administrative',
        addresstype: 'country',
        address: { country: 'Singapore', country_code: 'sg' },
      };

      expect(getCitySuggestionName(suggestion)).toBe('Singapore');
      expect(isLikelyCitySuggestion(suggestion)).toBe(true);
    });

    it('accepts structured city results without relying on featuretype=city', () => {
      expect(isLikelyCitySuggestion({
        name: 'Tokyo',
        display_name: 'Tokyo, Japan',
        lat: '35.6769',
        lon: '139.7639',
        class: 'boundary',
        type: 'administrative',
        addresstype: 'city',
        address: { city: 'Tokyo', country: 'Japan', country_code: 'jp' },
      })).toBe(true);
    });

    it('accepts country/capital-style results such as Luxembourg', () => {
      const suggestion = {
        display_name: 'Luxembourg',
        lat: '49.6113',
        lon: '6.1298',
        namedetails: { name: 'Luxembourg' },
        class: 'boundary',
        type: 'administrative',
        addresstype: 'country',
        address: { country: 'Luxembourg', country_code: 'lu' },
      };

      expect(getCitySuggestionName(suggestion)).toBe('Luxembourg');
      expect(isLikelyCitySuggestion(suggestion)).toBe(true);
    });

    it('filters obvious non-place results from broad Nominatim city search', () => {
      expect(isLikelyCitySuggestion({
        name: 'Paris Cafe',
        display_name: 'Paris Cafe, Main Street',
        lat: '1',
        lon: '2',
        class: 'amenity',
        type: 'cafe',
        addresstype: 'amenity',
        address: { country: 'France', country_code: 'fr' },
      })).toBe(false);
    });

    it('orders exact city matches ahead of broader country/admin fallbacks', () => {
      const ordered = orderCitySuggestions([
        {
          name: 'Luxembourg',
          display_name: 'Luxembourg',
          lat: '49.8153',
          lon: '6.1296',
          class: 'boundary',
          type: 'administrative',
          addresstype: 'country',
          address: { country: 'Luxembourg', country_code: 'lu' },
        },
        {
          name: 'Luxembourg City',
          display_name: 'Luxembourg City, Luxembourg',
          lat: '49.6113',
          lon: '6.1298',
          class: 'place',
          type: 'city',
          addresstype: 'city',
          address: { city: 'Luxembourg', country: 'Luxembourg', country_code: 'lu' },
        },
      ], 'Luxembourg');

      expect(ordered[0].addresstype).toBe('city');
    });

    it('accepts major city results from the fallback geocoder shape', () => {
      expect(isLikelyCitySuggestion({
        name: 'Marseille',
        display_name: 'Marseille, France',
        lat: '43.2963986',
        lon: '5.3777888',
        class: 'place',
        type: 'city',
        addresstype: 'city',
        address: { city: 'Marseille', country: 'France', country_code: 'fr' },
        source: 'photon',
      })).toBe(true);
      expect(isLikelyCitySuggestion({
        name: 'Manchester',
        display_name: 'Manchester, United Kingdom',
        lat: '53.4424618',
        lon: '-2.2324547',
        class: 'place',
        type: 'city',
        addresstype: 'city',
        address: { city: 'Manchester', country: 'United Kingdom', country_code: 'gb' },
        source: 'photon',
      })).toBe(true);
    });

    it('orders Luxembourg city ahead of the same-name country from fallback results', () => {
      const ordered = orderCitySuggestions([
        {
          name: 'Luxembourg',
          display_name: 'Luxembourg',
          lat: '49.8158683',
          lon: '6.1296751',
          class: 'place',
          type: 'country',
          addresstype: 'country',
          address: { country: 'Luxembourg', country_code: 'lu' },
          source: 'photon',
        },
        {
          name: 'Luxembourg',
          display_name: 'Luxembourg, Luxembourg',
          lat: '49.6112768',
          lon: '6.129799',
          class: 'place',
          type: 'city',
          addresstype: 'city',
          address: { city: 'Luxembourg', country: 'Luxembourg', country_code: 'lu' },
          source: 'photon',
        },
      ], 'luxembourg');

      expect(ordered[0].addresstype).toBe('city');
    });
  });

  describe('buildNominatimAddress', () => {
    it('includes the house number when Nominatim returned one', () => {
      expect(
        buildNominatimAddress({
          house_number: '12',
          road: 'Strada Alexandru Ioan Cuza',
          neighbourhood: 'Centrul Istoric',
          city: 'Craiova',
        }),
      ).toBe('Strada Alexandru Ioan Cuza 12, Centrul Istoric, Craiova');
    });

    it('omits the number when Nominatim has no house_number', () => {
      expect(
        buildNominatimAddress({
          road: 'Strada Alexandru Ioan Cuza',
          neighbourhood: 'Centrul Istoric',
          city: 'Craiova',
        }),
      ).toBe('Strada Alexandru Ioan Cuza, Centrul Istoric, Craiova');
    });

    it('falls back to suburb when neighbourhood is missing', () => {
      expect(
        buildNominatimAddress({
          house_number: '5',
          road: 'Bulevardul Unirii',
          suburb: 'Sector 3',
          city: 'București',
        }),
      ).toBe('Bulevardul Unirii 5, Sector 3, București');
    });

    it('falls back to town / village / municipality when city is missing', () => {
      expect(
        buildNominatimAddress({
          house_number: '10',
          road: 'Main St',
          town: 'Pipera',
        }),
      ).toBe('Main St 10, Pipera');
    });

    it('accepts pedestrian / footway in place of road', () => {
      expect(
        buildNominatimAddress({
          house_number: '7',
          pedestrian: 'Pasajul Victoria',
          city: 'București',
        }),
      ).toBe('Pasajul Victoria 7, București');
    });

    it('falls back to the first three parts of display_name when road is missing', () => {
      expect(
        buildNominatimAddress(
          undefined,
          'Parcul Herăstrău, Sector 1, București, Municipiul București, România',
        ),
      ).toBe('Parcul Herăstrău, Sector 1, București');
    });

    it('returns empty string when nothing is available', () => {
      expect(buildNominatimAddress(undefined)).toBe('');
    });
  });
});
