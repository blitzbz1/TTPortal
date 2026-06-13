// T052: shared venue-form state + validation. One hook backs the three venue
// forms (AddVenueScreen, the admin VenueEditModal, VenueChangeRequestModal)
// that previously each duplicated the ~22-field useState/patch-handler dance.
// Field rendering lives in src/components/VenueFormFields.tsx.
import { useCallback, useMemo, useState } from 'react';
import type { VenueCondition } from '../types/database';

/** Patch shape emitted by AddressPickerField's onChange. */
export interface VenueAddressPatch {
  address?: string;
  city?: string;
  lat?: number | null;
  lng?: number | null;
  countryCode?: string | null;
  countryName?: string | null;
  cityCenterLat?: number | null;
  cityCenterLng?: number | null;
  cityZoom?: number | null;
}

export interface VenueFormValues {
  name: string;
  type: string;
  /** Raw text from the numeric input — parse with parseTablesCount. */
  tables: string;
  city: string;
  address: string;
  description: string;
  lat: number | null;
  lng: number | null;
  countryCode: string | null;
  countryName: string | null;
  cityCenterLat: number | null;
  cityCenterLng: number | null;
  cityZoom: number | null;
  condition: VenueCondition;
  nightLighting: boolean | null;
  nets: boolean | null;
  verified: boolean;
  photos: string[];
  /** True once the user has confirmed the pin location (AddVenue flow). */
  locationConfirmed: boolean;
}

export const EMPTY_VENUE_FORM: VenueFormValues = {
  name: '',
  type: 'parc_exterior',
  tables: '',
  city: '',
  address: '',
  description: '',
  lat: null,
  lng: null,
  countryCode: null,
  countryName: null,
  cityCenterLat: null,
  cityCenterLng: null,
  cityZoom: null,
  condition: 'necunoscuta',
  nightLighting: null,
  nets: null,
  verified: false,
  photos: [],
  locationConfirmed: false,
};

/** Loose venue row shape (DB rows reach the admin screens untyped). */
export interface VenueFormSource {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  cities?: {
    country_code?: string | null;
    country_name?: string | null;
    lat?: number | null;
    lng?: number | null;
    zoom?: number | null;
  } | null;
  lat?: number | null;
  lng?: number | null;
  type?: string | null;
  tables_count?: number | null;
  condition?: VenueCondition | null;
  night_lighting?: boolean | null;
  nets?: boolean | null;
  verified?: boolean | null;
  photos?: unknown;
  description?: string | null;
}

/** Map a venue row to form values — the admin edit modal's init path. */
export function venueFormFromVenue(venue: VenueFormSource): VenueFormValues {
  return {
    name: venue.name ?? '',
    address: venue.address ?? '',
    city: venue.city ?? '',
    countryCode: venue.cities?.country_code ?? null,
    countryName: venue.cities?.country_name ?? null,
    cityCenterLat: typeof venue.cities?.lat === 'number' ? venue.cities.lat : null,
    cityCenterLng: typeof venue.cities?.lng === 'number' ? venue.cities.lng : null,
    cityZoom: typeof venue.cities?.zoom === 'number' ? venue.cities.zoom : null,
    lat: typeof venue.lat === 'number' ? venue.lat : null,
    lng: typeof venue.lng === 'number' ? venue.lng : null,
    type: venue.type ?? 'parc_exterior',
    tables: venue.tables_count != null ? String(venue.tables_count) : '',
    condition: venue.condition ?? 'necunoscuta',
    nightLighting: typeof venue.night_lighting === 'boolean' ? venue.night_lighting : null,
    nets: typeof venue.nets === 'boolean' ? venue.nets : null,
    verified: venue.verified === true,
    photos: Array.isArray(venue.photos)
      ? venue.photos.filter((url: unknown): url is string => typeof url === 'string' && url.length > 0)
      : [],
    description: venue.description ?? '',
    locationConfirmed: false,
  };
}

export interface TablesCountCheck {
  /** Whether the input contains anything beyond whitespace. */
  provided: boolean;
  value: number | null;
  valid: boolean;
}

/**
 * Parse + validate the tables-count text input.
 * - default mode mirrors AddVenueScreen: parseInt, so "3x" parses as 3;
 * - `integerOnly` mirrors VenueChangeRequestModal: Number + isInteger.
 * Whitespace-only input is "not provided" (and not valid).
 */
export function parseTablesCount(
  text: string,
  { min = 1, max = 100, integerOnly = false }: { min?: number; max?: number; integerOnly?: boolean } = {},
): TablesCountCheck {
  const trimmed = text.trim();
  if (trimmed === '') return { provided: false, value: null, valid: false };
  const value = integerOnly ? Number(trimmed) : parseInt(trimmed, 10);
  const valid = integerOnly
    ? Number.isInteger(value) && value >= min && value <= max
    : !Number.isNaN(value) && value >= min && value <= max;
  return { provided: true, value: Number.isNaN(value) ? null : value, valid };
}

export type VenueSubmissionErrorKey =
  | 'nameRequired'
  | 'cityRequired'
  | 'addressRequired'
  | 'dragPinHint'
  | 'genericError';

/**
 * AddVenueScreen's submit gate, in its original check order. Returns the
 * i18n key of the first failing rule (existing locale keys only) or null.
 */
export function validateVenueSubmission(values: VenueFormValues): VenueSubmissionErrorKey | null {
  if (!values.name.trim()) return 'nameRequired';
  if (!values.city.trim()) return 'cityRequired';
  if (values.cityCenterLat == null || values.cityCenterLng == null || !values.countryCode) {
    return 'cityRequired';
  }
  if (!values.address.trim()) return 'addressRequired';
  if (!values.locationConfirmed || values.lat == null || values.lng == null) return 'dragPinHint';
  if (values.tables) {
    const { valid } = parseTablesCount(values.tables, { min: 1, max: 100 });
    if (!valid) return 'genericError';
  }
  return null;
}

export interface UseVenueFormOptions {
  /**
   * AddVenue flow: a non-null lat/lng arriving through the AddressPickerField
   * patch means the user confirmed the pin, so flip locationConfirmed.
   */
  confirmLocationOnCoords?: boolean;
}

export interface UseVenueFormReturn {
  values: VenueFormValues;
  set: (patch: Partial<VenueFormValues>) => void;
  applyAddressPatch: (patch: VenueAddressPatch) => void;
  initFromVenue: (venue: VenueFormSource) => void;
  reset: () => void;
}

export function useVenueForm(options?: UseVenueFormOptions): UseVenueFormReturn {
  const confirmLocationOnCoords = options?.confirmLocationOnCoords === true;
  const [values, setValues] = useState<VenueFormValues>(EMPTY_VENUE_FORM);

  const set = useCallback((patch: Partial<VenueFormValues>) => {
    setValues((prev) => ({ ...prev, ...patch }));
  }, []);

  const applyAddressPatch = useCallback((patch: VenueAddressPatch) => {
    setValues((prev) => {
      const next = { ...prev };
      if (patch.address !== undefined) next.address = patch.address;
      if (patch.city !== undefined) next.city = patch.city;
      if (patch.lat !== undefined) next.lat = patch.lat;
      if (patch.lng !== undefined) next.lng = patch.lng;
      if (patch.countryCode !== undefined) next.countryCode = patch.countryCode;
      if (patch.countryName !== undefined) next.countryName = patch.countryName;
      if (patch.cityCenterLat !== undefined) next.cityCenterLat = patch.cityCenterLat;
      if (patch.cityCenterLng !== undefined) next.cityCenterLng = patch.cityCenterLng;
      if (patch.cityZoom !== undefined) next.cityZoom = patch.cityZoom;
      if (confirmLocationOnCoords && ((patch.lat !== undefined && patch.lat != null) || (patch.lng !== undefined && patch.lng != null))) {
        next.locationConfirmed = true;
      }
      return next;
    });
  }, [confirmLocationOnCoords]);

  const initFromVenue = useCallback((venue: VenueFormSource) => {
    setValues(venueFormFromVenue(venue));
  }, []);

  const reset = useCallback(() => {
    setValues(EMPTY_VENUE_FORM);
  }, []);

  return useMemo(
    () => ({ values, set, applyAddressPatch, initFromVenue, reset }),
    [values, set, applyAddressPatch, initFromVenue, reset],
  );
}
