const mockGetVenueById = jest.fn();
const mockGetProfile = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const mockUser = { id: 'u1', user_metadata: { full_name: 'Admin User' } };
jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({
    session: { user: mockUser },
    user: mockUser,
    isLoading: false,
  }),
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
jest.mock('../../services/reviews', () => ({
  getReviewsForVenue: jest.fn().mockResolvedValue({ data: [] }),
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

 
import React from 'react';
 
import { render, waitFor } from '@testing-library/react-native';
 
import { VenueDetailScreen } from '../VenueDetailScreen';

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

describe('VenueDetailScreen — admin photo button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVenueById.mockResolvedValue({ data: VENUE });
    // get_venue_detail RPC: bundle for the screen.
    // get_friends_at_venue RPC: returns []
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_venue_detail') {
        return Promise.resolve({
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
        });
      }
      return Promise.resolve({ data: [], error: null });
    });
  });

  it('shows add photo button for admin users', async () => {
    mockGetProfile.mockResolvedValue({ data: { id: 'u1', is_admin: true } });

    const { getByTestId } = render(<VenueDetailScreen venueId="1" />);

    await waitFor(() => {
      expect(getByTestId('admin-add-photo')).toBeTruthy();
    });
  });

  it('hides add photo button for non-admin users', async () => {
    mockGetProfile.mockResolvedValue({ data: { id: 'u1', is_admin: false } });

    const { queryByTestId } = render(<VenueDetailScreen venueId="1" />);

    await waitFor(() => {
      expect(queryByTestId('admin-add-photo')).toBeNull();
    });
  });
});
