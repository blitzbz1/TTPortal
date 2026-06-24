// Exercises the merged "Suggest an edit" dual-write handler in VenueDetailScreen:
// one Submit can record a condition vote, a change request, or both.
const mockGetVenueById = jest.fn();
const mockGetProfile = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const mockUser = { id: 'u1', user_metadata: { full_name: 'Test User' } };
jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({ session: { user: mockUser }, user: mockUser, isLoading: false }),
}));
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    s: (key: string) => require('../../locales/en.json')[key] || key,
    lang: 'en' as const,
    setLang: jest.fn(),
  }),
}));
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    mode: 'light',
    resolved: 'light',
    isDark: false,
    setMode: jest.fn(),
  }),
}));

jest.mock('../../services/venues', () => ({
  getVenueById: (...args: any[]) => mockGetVenueById(...args),
  uploadVenuePhoto: jest.fn(),
  addPhotoToVenue: jest.fn(),
}));
const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));
const mockGetReviewsForVenue = jest.fn();
jest.mock('../../services/reviews', () => ({
  getReviewsForVenue: (...a: any[]) => mockGetReviewsForVenue(...a),
}));
jest.mock('../../services/checkins', () => ({
  checkin: jest.fn(),
  checkout: jest.fn(),
  getUserActiveCheckin: jest.fn().mockResolvedValue({ data: null }),
  getUserAnyActiveCheckin: jest.fn().mockResolvedValue({ data: null }),
  getActiveFriendCheckins: jest.fn().mockResolvedValue({ data: [] }),
  getVenueChampion: jest.fn().mockResolvedValue({ data: null }),
}));
jest.mock('../../services/events', () => ({
  getUpcomingEventsByVenue: jest.fn().mockResolvedValue({ data: [] }),
  getUpcomingEventCountByVenue: jest.fn().mockResolvedValue({ data: 0 }),
  getActiveFriendEvents: jest.fn().mockResolvedValue({ data: [] }),
}));
jest.mock('../../services/friends', () => ({
  getFriendIds: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../services/favorites', () => ({
  isFavorite: jest.fn().mockResolvedValue({ data: false }),
  addFavorite: jest.fn(),
  removeFavorite: jest.fn(),
}));
jest.mock('../../services/profiles', () => ({
  getProfile: (...args: any[]) => mockGetProfile(...args),
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

const mockSubmitVote = jest.fn();
const mockUploadConditionVotePhoto = jest.fn();
jest.mock('../../services/conditions', () => ({
  submitVote: (...a: any[]) => mockSubmitVote(...a),
  uploadConditionVotePhoto: (...a: any[]) => mockUploadConditionVotePhoto(...a),
  CONDITION_MAP: { good: 'buna', acceptable: 'acceptabila', damaged: 'deteriorata' },
}));

const mockSubmitChangeRequest = jest.fn();
const mockUploadChangeRequestImage = jest.fn();
jest.mock('../../services/venueChangeRequests', () => ({
  submitVenueChangeRequest: (...a: any[]) => mockSubmitChangeRequest(...a),
  uploadChangeRequestImage: (...a: any[]) => mockUploadChangeRequestImage(...a),
}));

const mockShowAlert = jest.fn();
jest.mock('../../lib/dialogs', () => ({
  showAlert: (...a: any[]) => mockShowAlert(...a),
  showConfirm: jest.fn(),
}));

import React from 'react';
import { render as rtlRender, fireEvent, waitFor } from '@testing-library/react-native';

import { VenueDetailScreen } from '../VenueDetailScreen';
import { OfflineQueueProvider } from '../../contexts/OfflineQueueProvider';

const render = (ui: React.ReactElement) =>
  rtlRender(<OfflineQueueProvider>{ui}</OfflineQueueProvider>);

const VENUE = {
  id: 1,
  name: 'Test Venue',
  type: 'parc_exterior',
  city: 'București',
  address: 'Street 1',
  lat: 44.4,
  lng: 26.1,
  tables_count: 2,
  condition: 'buna',
  photos: null,
  verified: false,
  free_access: true,
  night_lighting: false,
  nets: true,
  hours: null,
  venue_stats: { venue_id: 1, avg_rating: 0, review_count: 0, checkin_count: 0, favorite_count: 0 },
};

async function openModal() {
  const utils = render(<VenueDetailScreen venueId="1" />);
  const btn = await utils.findByTestId('suggest-edit-btn');
  fireEvent.press(btn);
  await utils.findByTestId('vcr-submit');
  return utils;
}

describe('VenueDetailScreen — merged suggest-edit / condition-vote handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProfile.mockResolvedValue({ data: { id: 'u1', is_admin: false } });
    mockGetVenueById.mockResolvedValue({ data: VENUE });
    mockRpc.mockImplementation((fn: string) =>
      fn === 'get_venue_detail'
        ? Promise.resolve({
            data: {
              venue: VENUE,
              stats: VENUE.venue_stats,
              is_favorited: false,
              user_active_checkin: null,
              upcoming_event_count: 0,
              champion: null,
              recent_reviews: [],
            },
            error: null,
          })
        : Promise.resolve({ data: [], error: null }),
    );
    mockSubmitVote.mockResolvedValue({ data: { id: 9 }, error: null });
    mockSubmitChangeRequest.mockResolvedValue({ data: 1, error: null });
    mockGetReviewsForVenue.mockResolvedValue({ data: [], error: null });
  });

  it('uses a compact empty review row', async () => {
    const utils = render(<VenueDetailScreen venueId="1" />);
    expect(await utils.findByTestId('empty-reviews-cta')).toBeTruthy();
  });

  it('shows three reviews by default and can expand and collapse', async () => {
    const reviews = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      venue_id: 1,
      user_id: `reviewer-${index + 1}`,
      reviewer_name: `Reviewer ${index + 1}`,
      rating: index === 4 ? 5 : 4,
      body: `Body ${index + 1}`,
      created_at: new Date(2026, 0, index + 1).toISOString(),
    }));
    mockGetReviewsForVenue.mockResolvedValue({ data: reviews, error: null });
    mockRpc.mockImplementation((fn: string) =>
      fn === 'get_venue_detail'
        ? Promise.resolve({
            data: {
              venue: VENUE,
              stats: { ...VENUE.venue_stats, review_count: 5 },
              is_favorited: false,
              user_active_checkin: null,
              upcoming_event_count: 0,
              champion: null,
              recent_reviews: reviews.slice(-5).reverse(),
            },
            error: null,
          })
        : Promise.resolve({ data: [], error: null }),
    );

    const utils = render(<VenueDetailScreen venueId="1" />);
    await utils.findByTestId('review-card-5');
    expect(utils.getByTestId('review-card-4')).toBeTruthy();
    expect(utils.getByTestId('review-card-3')).toBeTruthy();
    expect(utils.queryByTestId('review-card-2')).toBeNull();

    fireEvent.press(utils.getByTestId('reviews-expand-toggle'));
    expect(utils.getByTestId('review-card-2')).toBeTruthy();
    expect(utils.getByTestId('review-card-1')).toBeTruthy();

    fireEvent.press(utils.getByTestId('reviews-expand-toggle'));
    expect(utils.queryByTestId('review-card-2')).toBeNull();
    expect(utils.getByTestId('review-sort-oldest')).toBeTruthy();
    expect(utils.getByTestId('review-sort-top')).toBeTruthy();
  });

  it('hides the amenities grid and the modal amenity fields for outdoor parks', async () => {
    // VENUE.type is 'parc_exterior'.
    const utils = render(<VenueDetailScreen venueId="1" />);
    await utils.findByTestId('suggest-edit-btn');
    // The "Amenities, fees & access" grid is not rendered for a park.
    expect(utils.queryByTestId('amenity-unknown-rental')).toBeNull();
    // Nor are the amenity fields inside the suggest-edit modal.
    fireEvent.press(utils.getByTestId('suggest-edit-btn'));
    await utils.findByTestId('vcr-submit');
    expect(utils.queryByTestId('vcr-amenity-rental-true')).toBeNull();
    expect(utils.queryByTestId('vcr-entryfee-free')).toBeNull();
    // Condition + structural edit fields are still there.
    expect(utils.getByTestId('vcr-condition-good')).toBeTruthy();
    expect(utils.getByTestId('vcr-nets-false')).toBeTruthy();
  });

  it('shows amenities (grid + modal fields) for indoor halls', async () => {
    const indoor = { ...VENUE, type: 'sala_indoor' };
    mockGetVenueById.mockResolvedValue({ data: indoor });
    mockRpc.mockImplementation((fn: string) =>
      fn === 'get_venue_detail'
        ? Promise.resolve({
            data: {
              venue: indoor,
              stats: VENUE.venue_stats,
              is_favorited: false,
              user_active_checkin: null,
              upcoming_event_count: 0,
              champion: null,
              recent_reviews: [],
            },
            error: null,
          })
        : Promise.resolve({ data: [], error: null }),
    );
    const utils = render(<VenueDetailScreen venueId="1" />);
    await utils.findByTestId('suggest-edit-btn');
    // Grid renders amenity rows (unknown → "tell us") for an indoor hall.
    expect(utils.getByTestId('amenity-unknown-rental')).toBeTruthy();
    fireEvent.press(utils.getByTestId('suggest-edit-btn'));
    await utils.findByTestId('vcr-amenity-rental-true');
  });

  it('condition-only submit records a vote and no change request', async () => {
    const { getByTestId } = await openModal();
    fireEvent.press(getByTestId('vcr-condition-good'));
    fireEvent.press(getByTestId('vcr-submit'));

    await waitFor(() => expect(mockSubmitVote).toHaveBeenCalledTimes(1));
    expect(mockSubmitVote).toHaveBeenCalledWith({
      user_id: 'u1',
      venue_id: 1,
      condition: 'buna',
      photo_url: null,
      note: null,
    });
    expect(mockSubmitChangeRequest).not.toHaveBeenCalled();
  });

  it('condition + note (no edit) attaches the note to the vote', async () => {
    const { getByTestId } = await openModal();
    fireEvent.press(getByTestId('vcr-condition-good'));
    fireEvent.changeText(getByTestId('vcr-note-input'), '  left leg wobbly  ');
    fireEvent.press(getByTestId('vcr-submit'));

    await waitFor(() => expect(mockSubmitVote).toHaveBeenCalledTimes(1));
    expect(mockSubmitVote).toHaveBeenCalledWith({
      user_id: 'u1',
      venue_id: 1,
      condition: 'buna',
      photo_url: null,
      note: 'left leg wobbly',
    });
    expect(mockSubmitChangeRequest).not.toHaveBeenCalled();
  });

  it('edit-only submit records a change request and no vote', async () => {
    const { getByTestId } = await openModal();
    // Venue starts with nets=true; propose nets=false.
    fireEvent.press(getByTestId('vcr-nets-false'));
    fireEvent.press(getByTestId('vcr-submit'));

    await waitFor(() => expect(mockSubmitChangeRequest).toHaveBeenCalledTimes(1));
    expect(mockSubmitChangeRequest).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ nets: false, photoUrl: null }),
    );
    expect(mockSubmitVote).not.toHaveBeenCalled();
  });

  it('edit + condition submit records both', async () => {
    const { getByTestId } = await openModal();
    fireEvent.press(getByTestId('vcr-nets-false'));
    fireEvent.press(getByTestId('vcr-condition-damaged'));
    fireEvent.press(getByTestId('vcr-submit'));

    await waitFor(() => expect(mockSubmitChangeRequest).toHaveBeenCalledTimes(1));
    expect(mockSubmitVote).toHaveBeenCalledWith({
      user_id: 'u1',
      venue_id: 1,
      condition: 'deteriorata',
      photo_url: null,
      note: null,
    });
    expect(mockSubmitChangeRequest).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ nets: false }),
    );
  });

  it('with an edit present, the note rides the change request and not the vote', async () => {
    const { getByTestId } = await openModal();
    fireEvent.press(getByTestId('vcr-nets-false'));
    fireEvent.press(getByTestId('vcr-condition-good'));
    fireEvent.changeText(getByTestId('vcr-note-input'), 'gone now');
    fireEvent.press(getByTestId('vcr-submit'));

    await waitFor(() => expect(mockSubmitChangeRequest).toHaveBeenCalledTimes(1));
    // Note belongs to the moderated change request; the vote keeps note null.
    expect(mockSubmitVote).toHaveBeenCalledWith(expect.objectContaining({ note: null }));
    expect(mockSubmitChangeRequest).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ nets: false, note: 'gone now' }),
    );
  });

  it('keeps the committed vote when the change-request leg fails (no double-vote on retry)', async () => {
    mockSubmitChangeRequest.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const { getByTestId } = await openModal();
    fireEvent.press(getByTestId('vcr-nets-false'));
    fireEvent.press(getByTestId('vcr-condition-good'));
    fireEvent.press(getByTestId('vcr-submit'));

    await waitFor(() => expect(mockSubmitChangeRequest).toHaveBeenCalledTimes(1));
    // Vote was committed once; an error was surfaced.
    expect(mockSubmitVote).toHaveBeenCalledTimes(1);
    expect(mockShowAlert).toHaveBeenCalled();

    // Retry: change request now succeeds. The vote re-upserts (idempotent) and
    // the change request is finally submitted.
    fireEvent.press(getByTestId('vcr-submit'));
    await waitFor(() => expect(mockSubmitChangeRequest).toHaveBeenCalledTimes(2));
  });
});
