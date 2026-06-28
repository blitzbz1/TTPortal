// Stage 3 (T074) — static guardrail on the slim venue payload shape. Goes RED if
// any of the 5 dropped fields (city/city_id/approved/created_at/updated_at) is
// re-added to PersistedVenue, or if a kept field is removed — so a future change
// that re-fattens the map/list row is caught in review.
import type { PersistedVenue } from '../venuesPersistentCache';

// A value typed as PersistedVenue with EXACTLY the 12 kept fields. If a field is
// added to the interface, this object is missing it → TS error (compile-time
// guard). If a field is removed, the corresponding key below is excess → TS error.
const REFERENCE: PersistedVenue = {
  id: 1,
  name: 'V',
  type: 'parc_exterior',
  address: 'A',
  lat: 1,
  lng: 2,
  tables_count: null,
  condition: null,
  free_access: null,
  night_lighting: null,
  nets: null,
  verified: null,
};

const KEPT = [
  'address', 'condition', 'free_access', 'id', 'lat', 'lng',
  'name', 'nets', 'night_lighting', 'tables_count', 'type', 'verified',
].sort();

const DROPPED = ['city', 'city_id', 'approved', 'created_at', 'updated_at'];

describe('PersistedVenue payload shape (Stage 3 guardrail)', () => {
  it('carries exactly the 12 kept fields', () => {
    expect(Object.keys(REFERENCE).sort()).toEqual(KEPT);
  });

  it('does not carry any of the 5 dropped fields', () => {
    for (const dead of DROPPED) {
      expect(Object.prototype.hasOwnProperty.call(REFERENCE, dead)).toBe(false);
    }
  });
});
