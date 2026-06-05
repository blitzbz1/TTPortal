import {
  approvedFilterFromVisibility,
  extractVenueTableCountFromName,
  findNearestVenue,
  googleMapsVenueUrl,
  isVenueDuplicateNameMatch,
  normalizeVenueDuplicateName,
  venueNeedsAttention,
} from '../../web/src/components/admin/venue-dashboard/venueDashboardUtils';
import type { AdminVenue } from '../../web/src/lib/admin-service';

function venue(overrides: Partial<AdminVenue> = {}): AdminVenue {
  return {
    id: 1,
    name: 'Club Test',
    city: 'Berlin',
    address: 'Main street 1',
    type: 'parc_exterior',
    tables_count: 2,
    condition: 'buna',
    description: null,
    lat: 52.52,
    lng: 13.405,
    approved: true,
    flagged_review_count: 0,
    ...overrides,
  };
}

describe('admin venue dashboard utilities', () => {
  it('maps visibility filters to the approved flag used by the app', () => {
    expect(approvedFilterFromVisibility('visible')).toBe(true);
    expect(approvedFilterFromVisibility('hidden')).toBe(false);
    expect(approvedFilterFromVisibility('')).toBeNull();
    expect(approvedFilterFromVisibility('anything-else')).toBeNull();
  });

  it('flags venues needing admin attention', () => {
    expect(venueNeedsAttention(venue())).toBe(false);
    expect(venueNeedsAttention(venue({ flagged_review_count: 1 }))).toBe(true);
    expect(venueNeedsAttention(venue({ address: null }))).toBe(true);
    expect(venueNeedsAttention(venue({ tables_count: 0 }))).toBe(true);
    expect(venueNeedsAttention(venue({ condition: 'necunoscuta' }))).toBe(true);
  });

  it('prefers exact coordinates for external map lookup', () => {
    expect(googleMapsVenueUrl(venue())).toBe(
      'https://www.google.com/maps/search/?api=1&query=52.52,13.405',
    );
  });

  it('falls back to an encoded venue search when coordinates are missing', () => {
    expect(googleMapsVenueUrl(venue({ lat: null, lng: null }))).toBe(
      'https://www.google.com/maps/search/?api=1&query=Club%20Test%2C%20Main%20street%201%2C%20Berlin',
    );
  });

  it('normalizes table-count suffixes for duplicate matching', () => {
    expect(extractVenueTableCountFromName('Tennis da tavolo Via Roma (3)')).toEqual({
      name: 'Tennis da tavolo Via Roma',
      tableCount: 3,
    });
    expect(normalizeVenueDuplicateName('Tennis da tavolo Via Roma (3)')).toBe(
      normalizeVenueDuplicateName('tennis da tavolo via roma'),
    );
    expect(isVenueDuplicateNameMatch('Tennis da tavolo Via Roma (3)', 'Tennis da tavolo Via Roma')).toBe(true);
  });

  it('uses a wider duplicate radius when normalized names match', () => {
    const current = venue({ id: 1, name: 'Tennis da tavolo Via Roma (2)', lat: 45.070, lng: 7.680 });
    const candidate = venue({ id: 2, name: 'Tennis da tavolo Via Roma', lat: 45.073, lng: 7.682 });

    expect(findNearestVenue(current, [current, candidate], 120, 700)?.venue.id).toBe(2);
  });
});
