import {
  buildAddressFreeformQuery,
  buildAddressSearchRequests,
  buildStreetQueryVariants,
  mergeAndRankAddressSuggestions,
  resolveAddressSearchContext,
} from '../addressSearch';

function queryParams(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe('addressSearch', () => {
  it('builds a structured Barcelona street search constrained to Spain', () => {
    const requests = buildAddressSearchRequests('Avinguda Diagonal', {
      city: 'Barcelona',
      countryCode: 'ES',
    });

    expect(requests[0].kind).toBe('structured');
    expect(queryParams(requests[0].url).get('street')).toBe('Avinguda Diagonal');
    expect(queryParams(requests[0].url).get('city')).toBe('Barcelona');
    expect(queryParams(requests[0].url).get('countrycodes')).toBe('es');
  });

  it('builds a structured German street search constrained to Germany', () => {
    const requests = buildAddressSearchRequests('Königsallee', {
      city: 'Düsseldorf',
      countryCode: 'DE',
    });

    expect(requests[0].kind).toBe('structured');
    expect(queryParams(requests[0].url).get('street')).toBe('Königsallee');
    expect(queryParams(requests[0].url).get('city')).toBe('Düsseldorf');
    expect(queryParams(requests[0].url).get('countrycodes')).toBe('de');
  });

  it('infers a city country code from the local city catalog when the selected city is unique', () => {
    const resolved = resolveAddressSearchContext({
      city: 'Berlin',
      knownCityRecords: [
        { name: 'Barcelona', country_code: 'ES', country_name: 'Spain' },
        { name: 'Berlin', country_code: 'DE', country_name: 'Germany', lat: 52.517, lng: 13.388, zoom: 11 },
      ],
    });

    expect(resolved.countryCode).toBe('DE');
    expect(resolved.countryName).toBe('Germany');
    expect(resolved.cityCenterLat).toBe(52.517);
  });

  it('keeps the old free-form fallback but appends the city only once', () => {
    expect(buildAddressFreeformQuery('Avinguda Diagonal', 'Barcelona')).toBe('Avinguda Diagonal, Barcelona');
    expect(buildAddressFreeformQuery('Avinguda Diagonal, Barcelona', 'Barcelona')).toBe('Avinguda Diagonal, Barcelona');
  });

  it('generates country-aware street prefix variants without exploding request count', () => {
    expect(buildStreetQueryVariants('Av Diagonal', 'ES')).toEqual([
      'Av Diagonal',
      'Avenida Diagonal',
      'Avinguda Diagonal',
    ]);
    expect(buildStreetQueryVariants('Koenigsstrasse', 'DE')).toContain('Koenigsstraße');
    expect(buildStreetQueryVariants('Str Victoriei', 'RO')).toContain('Strada Victoriei');
  });

  it('adds a city viewbox and still keeps country as the hard filter', () => {
    const requests = buildAddressSearchRequests('Unter den Linden', {
      city: 'Berlin',
      countryCode: 'DE',
      cityCenterLat: 52.517,
      cityCenterLng: 13.388,
      cityZoom: 12,
    });

    const first = queryParams(requests[0].url);
    expect(first.get('countrycodes')).toBe('de');
    expect(first.get('viewbox')).toContain('13.');
  });

  it('ranks same-city street/address hits ahead of country-level or wrong-city noise', () => {
    const ranked = mergeAndRankAddressSuggestions([
      {
        weight: 10,
        items: [
          {
            display_name: 'Berlin, Germany',
            lat: '52.517',
            lon: '13.388',
            class: 'place',
            type: 'city',
            addresstype: 'city',
            address: { city: 'Berlin', country_code: 'de' },
          },
          {
            display_name: 'Hauptstraße, Schwante, Germany',
            lat: '52.73',
            lon: '13.09',
            class: 'highway',
            type: 'residential',
            address: { road: 'Hauptstraße', village: 'Schwante', country_code: 'de' },
          },
          {
            display_name: 'Hauptstraße, Berlin, Germany',
            lat: '52.49',
            lon: '13.41',
            class: 'highway',
            type: 'residential',
            address: { road: 'Hauptstraße', city: 'Berlin', country_code: 'de' },
          },
        ],
      },
    ], {
      city: 'Berlin',
      countryCode: 'DE',
      cityCenterLat: 52.517,
      cityCenterLng: 13.388,
    });

    expect(ranked[0].display_name).toBe('Hauptstraße, Berlin, Germany');
  });
});
