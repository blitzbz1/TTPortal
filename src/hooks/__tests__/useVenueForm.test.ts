import {
  EMPTY_VENUE_FORM,
  parseTablesCount,
  validateVenueSubmission,
  venueFormFromVenue,
  type VenueFormValues,
} from '../useVenueForm';

describe('useVenueForm — parseTablesCount', () => {
  it('treats empty and whitespace-only input as not provided (and not valid)', () => {
    expect(parseTablesCount('')).toEqual({ provided: false, value: null, valid: false });
    expect(parseTablesCount('   ')).toEqual({ provided: false, value: null, valid: false });
  });

  it('accepts an in-range count (AddVenue mode: 1..100)', () => {
    expect(parseTablesCount('2')).toEqual({ provided: true, value: 2, valid: true });
    expect(parseTablesCount('100')).toEqual({ provided: true, value: 100, valid: true });
  });

  it('rejects out-of-range and non-numeric input', () => {
    expect(parseTablesCount('0').valid).toBe(false);
    expect(parseTablesCount('101').valid).toBe(false);
    expect(parseTablesCount('ab').valid).toBe(false);
  });

  it('keeps parseInt leniency in default mode ("3x" parses as 3)', () => {
    expect(parseTablesCount('3x')).toEqual({ provided: true, value: 3, valid: true });
  });

  it('integerOnly mode (change requests: 0..200) rejects partial numbers', () => {
    const opts = { min: 0, max: 200, integerOnly: true };
    expect(parseTablesCount('0', opts)).toEqual({ provided: true, value: 0, valid: true });
    expect(parseTablesCount('200', opts).valid).toBe(true);
    expect(parseTablesCount('201', opts).valid).toBe(false);
    expect(parseTablesCount('3x', opts).valid).toBe(false);
    expect(parseTablesCount('3.5', opts).valid).toBe(false);
  });
});

describe('useVenueForm — validateVenueSubmission', () => {
  const validValues: VenueFormValues = {
    ...EMPTY_VENUE_FORM,
    name: 'Parc Tineretului',
    city: 'București',
    address: 'Str. X 1',
    countryCode: 'RO',
    countryName: 'Romania',
    cityCenterLat: 44.43,
    cityCenterLng: 26.1,
    cityZoom: 12,
    lat: 44.43,
    lng: 26.1,
    locationConfirmed: true,
  };

  it('passes a fully valid submission', () => {
    expect(validateVenueSubmission(validValues)).toBeNull();
  });

  it('requires a name first', () => {
    expect(validateVenueSubmission({ ...validValues, name: '  ' })).toBe('nameRequired');
  });

  it('requires a city', () => {
    expect(validateVenueSubmission({ ...validValues, city: '' })).toBe('cityRequired');
  });

  it('requires city metadata (center coords + country code)', () => {
    expect(validateVenueSubmission({ ...validValues, cityCenterLat: null })).toBe('cityRequired');
    expect(validateVenueSubmission({ ...validValues, cityCenterLng: null })).toBe('cityRequired');
    expect(validateVenueSubmission({ ...validValues, countryCode: null })).toBe('cityRequired');
  });

  it('requires an address', () => {
    expect(validateVenueSubmission({ ...validValues, address: ' ' })).toBe('addressRequired');
  });

  it('requires a confirmed pin location', () => {
    expect(validateVenueSubmission({ ...validValues, locationConfirmed: false })).toBe('dragPinHint');
    expect(validateVenueSubmission({ ...validValues, lat: null })).toBe('dragPinHint');
    expect(validateVenueSubmission({ ...validValues, lng: null })).toBe('dragPinHint');
  });

  it('rejects an invalid tables count but allows an empty one', () => {
    expect(validateVenueSubmission({ ...validValues, tables: '0' })).toBe('genericError');
    expect(validateVenueSubmission({ ...validValues, tables: 'abc' })).toBe('genericError');
    expect(validateVenueSubmission({ ...validValues, tables: '' })).toBeNull();
    expect(validateVenueSubmission({ ...validValues, tables: '4' })).toBeNull();
  });
});

describe('useVenueForm — venueFormFromVenue', () => {
  it('maps a venue row to form values', () => {
    const values = venueFormFromVenue({
      name: 'Parc Test',
      address: 'Str. Test',
      city: 'Cluj',
      cities: { country_code: 'RO', country_name: 'Romania', lat: 46.7, lng: 23.6, zoom: 12 },
      lat: 46.77,
      lng: 23.59,
      type: 'sala_indoor',
      tables_count: 3,
      condition: 'buna',
      night_lighting: true,
      nets: false,
      verified: true,
      photos: ['https://x/1.jpg', null, '', 'https://x/2.jpg'],
      description: 'desc',
    });
    expect(values).toMatchObject({
      name: 'Parc Test',
      address: 'Str. Test',
      city: 'Cluj',
      countryCode: 'RO',
      countryName: 'Romania',
      cityCenterLat: 46.7,
      cityCenterLng: 23.6,
      cityZoom: 12,
      lat: 46.77,
      lng: 23.59,
      type: 'sala_indoor',
      tables: '3',
      condition: 'buna',
      nightLighting: true,
      nets: false,
      verified: true,
      photos: ['https://x/1.jpg', 'https://x/2.jpg'],
      description: 'desc',
    });
  });

  it('falls back to defaults for missing fields', () => {
    const values = venueFormFromVenue({ name: 'Bare' });
    expect(values).toMatchObject({
      name: 'Bare',
      type: 'parc_exterior',
      tables: '',
      condition: 'necunoscuta',
      nightLighting: null,
      nets: null,
      verified: false,
      photos: [],
      locationConfirmed: false,
    });
  });
});
