// F012: structured venue amenities vocabulary. The amenities jsonb on venues
// stores a partial map of these keys; an absent key means "unknown". Labels are
// i18n keys (added to all 8 locales).

import type { VenueType } from '../types/database';

/**
 * Amenities, fees & access are an indoor-hall concept (rental desks, lockers,
 * entry fees, …). Outdoor parks don't have them, so the amenities grid on venue
 * detail and the amenity fields in the suggest-an-edit modal are hidden for
 * `parc_exterior` venues.
 */
export function venueSupportsAmenities(type: VenueType | null | undefined): boolean {
  return type === 'sala_indoor';
}

export const AMENITY_KEYS = [
  'rental',
  'ball_vending',
  'showers_lockers',
  'parking',
  'wheelchair',
  'cafe_water',
  'byo_net',
] as const;

export type AmenityKey = (typeof AMENITY_KEYS)[number];

export type EntryFee = 'free' | 'day_pass' | 'membership';
export const ENTRY_FEE_VALUES: EntryFee[] = ['free', 'day_pass', 'membership'];

export interface VenueAmenities {
  rental?: boolean;
  ball_vending?: boolean;
  showers_lockers?: boolean;
  parking?: boolean;
  wheelchair?: boolean;
  cafe_water?: boolean;
  byo_net?: boolean;
  entry_fee?: EntryFee;
}

/** i18n label key per boolean amenity. */
export const AMENITY_LABEL_KEYS: Record<AmenityKey, string> = {
  rental: 'amenityRental',
  ball_vending: 'amenityBallVending',
  showers_lockers: 'amenityShowersLockers',
  parking: 'amenityParking',
  wheelchair: 'amenityWheelchair',
  cafe_water: 'amenityCafeWater',
  byo_net: 'amenityByoNet',
};

/** i18n label key per entry-fee value. */
export const ENTRY_FEE_LABEL_KEYS: Record<EntryFee, string> = {
  free: 'amenityEntryFree',
  day_pass: 'amenityEntryDayPass',
  membership: 'amenityEntryMembership',
};
