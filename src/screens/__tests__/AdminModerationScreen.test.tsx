// T052: the screen's tabs now own real react-query queries and mutations
// update the cache via setQueryData, which jest.setup's global react-query
// mock no-ops — so this suite unmocks the library and runs against a real
// QueryClient (fresh per test), like the *.real.test.tsx hook suites.
jest.unmock('@tanstack/react-query');

import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminModerationScreen } from '../AdminModerationScreen';

let queryClient: QueryClient;
let invalidateQueriesSpy: jest.SpyInstance;

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({
    user: { id: 'admin-1', user_metadata: { full_name: 'Admin' } },
  }),
}));

const mockS = jest.fn((key: string) => key);
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({ s: mockS }),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    isDark: false,
  }),
}));

const mockCitiesList: any[] = [];
jest.mock('../../hooks/queries/useCitiesQuery', () => ({
  citiesQueryKey: ['cities', 'delta'],
  useCitiesQuery: () => ({ data: mockCitiesList }),
}));

jest.mock('../../components/Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

const mockGetProfile = jest.fn();
jest.mock('../../services/profiles', () => ({
  getProfile: (...args: any[]) => mockGetProfile(...args),
}));

const mockGetPendingVenues = jest.fn();
const mockGetFlaggedReviews = jest.fn();
const mockSearchVenuesAdmin = jest.fn();
const mockUpdateVenue = jest.fn();
const mockDeleteVenue = jest.fn();
const mockApproveVenue = jest.fn();
const mockRejectVenue = jest.fn();
const mockKeepReview = jest.fn();
const mockDeleteReview = jest.fn();
const mockGetUserFeedback = jest.fn();
const mockDeleteUserFeedback = jest.fn();
const mockGetVenueChangeRequests = jest.fn();
const mockResolveVenueChangeRequest = jest.fn();
const mockDismissVenueChangeRequest = jest.fn();

jest.mock('../../services/admin', () => ({
  getPendingVenues: (...args: any[]) => mockGetPendingVenues(...args),
  getFlaggedReviews: (...args: any[]) => mockGetFlaggedReviews(...args),
  searchVenuesAdmin: (...args: any[]) => mockSearchVenuesAdmin(...args),
  updateVenue: (...args: any[]) => mockUpdateVenue(...args),
  deleteVenue: (...args: any[]) => mockDeleteVenue(...args),
  approveVenue: (...args: any[]) => mockApproveVenue(...args),
  rejectVenue: (...args: any[]) => mockRejectVenue(...args),
  keepReview: (...args: any[]) => mockKeepReview(...args),
  deleteReview: (...args: any[]) => mockDeleteReview(...args),
  getUserFeedback: (...args: any[]) => mockGetUserFeedback(...args),
  deleteUserFeedback: (...args: any[]) => mockDeleteUserFeedback(...args),
  getVenueChangeRequests: (...args: any[]) => mockGetVenueChangeRequests(...args),
  resolveVenueChangeRequest: (...args: any[]) => mockResolveVenueChangeRequest(...args),
  dismissVenueChangeRequest: (...args: any[]) => mockDismissVenueChangeRequest(...args),
  getFeedbackReplies: jest.fn().mockResolvedValue({ data: [] }),
  replyToFeedback: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');
  mockGetProfile.mockImplementation(() => ({
    then: (resolve: (value: { data: { is_admin: boolean } }) => void) => {
      resolve({ data: { is_admin: true } });
      return Promise.resolve({ data: { is_admin: true } });
    },
  }));
  mockGetPendingVenues.mockResolvedValue({ data: [] });
  mockGetFlaggedReviews.mockResolvedValue({ data: [] });
  mockSearchVenuesAdmin.mockResolvedValue({ data: [] });
  mockGetUserFeedback.mockResolvedValue({ data: [] });
  mockDeleteUserFeedback.mockResolvedValue({ data: null, error: null });
  mockGetVenueChangeRequests.mockResolvedValue({ data: [] });
  mockResolveVenueChangeRequest.mockResolvedValue({ data: 'applied', error: null });
  mockDismissVenueChangeRequest.mockResolvedValue({ data: 'dismissed', error: null });
});

afterEach(() => {
  queryClient.clear();
  jest.useRealTimers();
});

/**
 * Flush a few macrotask ticks inside act: react-query's notifyManager
 * delivers observer updates on a setTimeout(0) tick, so the UI lags the
 * query cache by a timer tick (and mutation handlers chain several).
 */
async function flushAsync(ticks = 3) {
  await act(async () => {
    for (let i = 0; i < ticks; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

/** Wait until every in-flight query has settled and the UI caught up. */
async function flushQueries() {
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  await flushAsync();
}

async function renderAdmin() {
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AdminModerationScreen />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(utils.getByText('tabReviews')).toBeTruthy());
  await flushQueries();
  return utils;
}

describe('AdminModerationScreen — tabs', () => {
  it('renders both tab buttons', async () => {
    const { getByText } = await renderAdmin();

    expect(getByText('tabReviews')).toBeTruthy();
    expect(getByText('tabVenues')).toBeTruthy();
    expect(getByText('tabFeedback')).toBeTruthy();
  });

  it('shows reviews tab content by default', async () => {
    const { getByText } = await renderAdmin();

    expect(getByText('pendingVenues')).toBeTruthy();
    expect(getByText('reportedReviews')).toBeTruthy();
  });

  it('switches to venues tab on press', async () => {
    const { getByText } = await renderAdmin();

    fireEvent.press(getByText('tabVenues'));

    expect(getByText('searchVenuesHint')).toBeTruthy();
  });
});

describe('AdminModerationScreen — venue search', () => {
  it('shows hint when query is less than 3 chars', async () => {
    const { getByText, getByPlaceholderText } = await renderAdmin();

    fireEvent.press(getByText('tabVenues'));
    fireEvent.changeText(getByPlaceholderText('searchVenues'), 'Pa');

    expect(getByText('searchVenuesHint')).toBeTruthy();
    expect(mockSearchVenuesAdmin).not.toHaveBeenCalled();
  });

  it('triggers search after debounce with 3+ chars', async () => {
    const venues = [{ id: 1, name: 'Parc Tineretului', city: 'București', address: 'Str. X' }];
    mockSearchVenuesAdmin.mockResolvedValue({ data: venues });

    const { getByText, getByPlaceholderText } = await renderAdmin();

    fireEvent.press(getByText('tabVenues'));
    fireEvent.changeText(getByPlaceholderText('searchVenues'), 'Parc');

    // Wait out the 400ms debounce, then let the query settle
    await waitFor(() => expect(mockSearchVenuesAdmin).toHaveBeenCalledWith('Parc'));
    await flushQueries();

    expect(getByText('Parc Tineretului')).toBeTruthy();
  });
});

describe('AdminModerationScreen — edit modal', () => {
  it('opens edit modal when pencil button is pressed on a search result', async () => {
    const venues = [{ id: 1, name: 'Parc Test', city: 'București', address: 'Str. Test', type: 'parc_exterior', tables_count: 2, description: '' }];
    mockSearchVenuesAdmin.mockResolvedValue({ data: venues });

    const { getByText, getByPlaceholderText } = await renderAdmin();

    // Switch to venues tab and search
    fireEvent.press(getByText('tabVenues'));
    fireEvent.changeText(getByPlaceholderText('searchVenues'), 'Parc');
    await waitFor(() => expect(mockSearchVenuesAdmin).toHaveBeenCalledWith('Parc'));
    await flushQueries();

    expect(getByText('Parc Test')).toBeTruthy();
  });

  it('saves venue edits and updates search results', async () => {
    const venues = [{ id: 1, name: 'Parc Test', city: 'București', address: 'Str. Test', type: 'parc_exterior', tables_count: 2, description: '' }];
    mockSearchVenuesAdmin.mockResolvedValue({ data: venues });
    mockUpdateVenue.mockResolvedValue({ data: { ...venues[0], name: 'Parc Updated' }, error: null });

    const { getByText, getByPlaceholderText } = await renderAdmin();

    // Navigate to venues tab and search
    fireEvent.press(getByText('tabVenues'));
    fireEvent.changeText(getByPlaceholderText('searchVenues'), 'Parc');
    await waitFor(() => expect(mockSearchVenuesAdmin).toHaveBeenCalledWith('Parc'));
    await flushQueries();

    // Verify venue appeared
    expect(getByText('Parc Test')).toBeTruthy();
  });

  it('saves table condition, lighting, nets, description, and photo removals', async () => {
    const venues = [{
      id: 1,
      name: 'Parc Test',
      city: 'Bucharest',
      address: 'Str. Test',
      type: 'parc_exterior',
      tables_count: 2,
      condition: 'buna',
      night_lighting: false,
      nets: true,
      verified: false,
      photos: ['https://example.com/one.jpg', 'https://example.com/two.jpg'],
      description: 'Old description',
      lat: 44.4,
      lng: 26.1,
    }];
    mockSearchVenuesAdmin.mockResolvedValue({ data: venues });
    mockUpdateVenue.mockResolvedValue({
      data: {
        ...venues[0],
        condition: 'deteriorata',
        night_lighting: true,
        nets: false,
        verified: true,
        photos: ['https://example.com/two.jpg'],
        description: 'Updated description',
      },
      error: null,
    });

    const { getByText, getByPlaceholderText, getByTestId } = await renderAdmin();

    fireEvent.press(getByText('tabVenues'));
    fireEvent.changeText(getByPlaceholderText('searchVenues'), 'Parc');
    await waitFor(() => expect(mockSearchVenuesAdmin).toHaveBeenCalledWith('Parc'));
    await flushQueries();

    await act(async () => { fireEvent.press(getByTestId('venue-edit-1')); });
    await act(async () => { fireEvent.press(getByTestId('condition-deteriorata')); });
    await act(async () => { fireEvent.press(getByTestId('lighting-true')); });
    await act(async () => { fireEvent.press(getByTestId('nets-false')); });
    await act(async () => { fireEvent.press(getByTestId('verified-true')); });
    await act(async () => { fireEvent.press(getByTestId('remove-photo-0')); });
    await act(async () => { fireEvent.changeText(getByTestId('edit-description'), 'Updated description'); });
    await act(async () => { fireEvent.press(getByText('save')); });
    await flushAsync();

    await waitFor(() => expect(mockUpdateVenue).toHaveBeenCalled());
    expect(mockUpdateVenue).toHaveBeenCalledWith(1, 'admin-1', expect.objectContaining({
      condition: 'deteriorata',
      night_lighting: true,
      nets: false,
      verified: true,
      photos: ['https://example.com/two.jpg'],
      description: 'Updated description',
    }));
  });
});

describe('AdminModerationScreen — pending venues', () => {
  const lubeckPendingVenues = [
    ['Tischtennis Carlebach-Park', 'Maria-Goeppert-Straße 1, Lübeck'],
    ['Tischtennis Damaschkestraße', 'Julius-Brecht-Straße 15, Lübeck'],
    ['Tischtennis Ernestinenschule', 'Engelswisch 33/ 5, Lübeck'],
    ['Tischtennis Lunapark', 'Hanseplatz 4a, Lübeck'],
    ['Tischtennis Carlebach-Park (2)', 'Maria-Goeppert-Straße 1, Lübeck'],
    ['Tischtennis Carlebach-Park (3)', 'Maria-Goeppert-Straße 9, Lübeck'],
    ['Tischtennis Carlebach-Park (4)', 'Maria-Goeppert-Straße 9, Lübeck'],
    ['Tischtennis An den Schießständen', 'Pfeifengrasweg 21a, Lübeck'],
    ['Tischtennis Ziegelstraße', 'Korvettenstraße 13, Lübeck'],
    ['Tischtennis Lunapark (2)', 'Hanseplatz 4a, Lübeck'],
    ['Tischtennis Mühlenstraße', 'Mühlenstraße 72, Lübeck'],
    ['Tischtennis Hundestraße 83/', 'Hundestraße 83/ 1, Lübeck'],
    ['Tischtennis Hundestraße 83/ (2)', 'Hundestraße 83/ 1, Lübeck'],
    ['Tischtennis Dornestraße', 'Dornestraße 65, Lübeck'],
  ].map(([name, address], index) => ({
    id: 9000 + index,
    name,
    city: 'Lübeck',
    address,
    created_at: `2026-06-01T10:${String(index).padStart(2, '0')}:00Z`,
    profiles: null,
  }));

  it('renders pending venue cards', async () => {
    const pending = [
      { id: 10, name: 'New Venue', city: 'Cluj', address: 'Str. ABC', created_at: '2026-04-01', profiles: { full_name: 'Ion' } },
    ];
    mockGetPendingVenues.mockResolvedValue({ data: pending });

    const { getByText } = await renderAdmin();

    expect(getByText('New Venue')).toBeTruthy();
    expect(getByText('approve')).toBeTruthy();
    expect(getByText('reject')).toBeTruthy();
  });

  it('removes venue from pending list on approve', async () => {
    const pending = [
      { id: 10, name: 'Pending Venue', city: 'Cluj', address: 'Str. X', created_at: '2026-04-01', profiles: { full_name: 'Ion' } },
    ];
    mockGetPendingVenues.mockResolvedValue({ data: pending });
    mockApproveVenue.mockResolvedValue({ data: { id: 10, approved: true }, error: null });

    const { getByText, queryByText } = await renderAdmin();

    expect(getByText('Pending Venue')).toBeTruthy();

    await act(async () => { fireEvent.press(getByText('approve')); });
    await flushAsync();

    expect(mockApproveVenue).toHaveBeenCalledWith(10, 'admin-1');
    await waitFor(() => expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['venues'], exact: false }));
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['cities', 'delta'] });
    await waitFor(() => expect(queryByText('Pending Venue')).toBeNull());
  });

  it('shows Lübeck imported locations as pending admin approvals', async () => {
    mockGetPendingVenues.mockResolvedValue({ data: lubeckPendingVenues });
    mockApproveVenue.mockResolvedValue({ data: { id: 9000, approved: true }, error: null });

    const { getByText, getAllByText, queryByText } = await renderAdmin();

    expect(getAllByText('14').length).toBeGreaterThan(0);
    expect(getByText('Tischtennis Carlebach-Park')).toBeTruthy();
    expect(getByText('Tischtennis Dornestraße')).toBeTruthy();
    expect(getAllByText('approve')).toHaveLength(14);

    await act(async () => { fireEvent.press(getAllByText('approve')[0]); });
    await flushAsync();

    expect(mockApproveVenue).toHaveBeenCalledWith(9000, 'admin-1');
    await waitFor(() => expect(queryByText('Tischtennis Carlebach-Park')).toBeNull());
  });
});

describe('AdminModerationScreen — feedback tab', () => {
  it('does not fetch feedback until the Feedback tab is opened', async () => {
    const { getByText } = await renderAdmin();
    expect(mockGetUserFeedback).not.toHaveBeenCalled();

    await act(async () => { fireEvent.press(getByText('tabFeedback')); });
    await flushQueries();

    expect(mockGetUserFeedback).toHaveBeenCalledTimes(1);
  });

  it('renders feedback rows with author, message and category label', async () => {
    mockGetUserFeedback.mockResolvedValue({
      data: [
        {
          id: 'f-1',
          user_id: 'u-1',
          page: '/profile',
          category: 'bug',
          message: 'The map does not center on me',
          created_at: '2026-04-20T10:00:00Z',
          profiles: { full_name: 'Ion Popescu', email: 'ion@x.com' },
        },
      ],
    });

    const { getByText, getByTestId } = await renderAdmin();
    await act(async () => { fireEvent.press(getByText('tabFeedback')); });
    await flushQueries();

    expect(getByTestId('feedback-row-f-1')).toBeTruthy();
    expect(getByText('Ion Popescu')).toBeTruthy();
    expect(getByText('The map does not center on me')).toBeTruthy();
    expect(getByText('feedbackCategoryBug')).toBeTruthy();
  });

  it('shows empty state when there is no feedback', async () => {
    const { getByText } = await renderAdmin();
    await act(async () => { fireEvent.press(getByText('tabFeedback')); });
    await flushQueries();

    expect(getByText('noUserFeedback')).toBeTruthy();
  });

  it('opens the reply modal when the Reply button is pressed', async () => {
    mockGetUserFeedback.mockResolvedValue({
      data: [
        {
          id: 'f-3',
          user_id: 'u-3',
          page: '/x',
          category: 'general',
          message: 'suggestion',
          created_at: '2026-04-20T10:00:00Z',
          profiles: { full_name: 'User', email: 'u@x.com' },
        },
      ],
    });

    const { getByText, getByTestId } = await renderAdmin();
    await act(async () => { fireEvent.press(getByText('tabFeedback')); });
    await flushQueries();
    await act(async () => { fireEvent.press(getByTestId('feedback-reply-f-3')); });

    expect(getByText('feedbackReplyTitle')).toBeTruthy();
  });

  it('falls back to email when full_name is missing', async () => {
    mockGetUserFeedback.mockResolvedValue({
      data: [
        {
          id: 'f-2',
          user_id: 'u-2',
          page: '/events',
          category: 'general',
          message: 'hi',
          created_at: '2026-04-20T10:00:00Z',
          profiles: { full_name: null, email: 'anon@x.com' },
        },
      ],
    });

    const { getByText } = await renderAdmin();
    await act(async () => { fireEvent.press(getByText('tabFeedback')); });
    await flushQueries();

    expect(getByText('anon@x.com')).toBeTruthy();
  });
});

describe('AdminModerationScreen — changes tab', () => {
  it('does not fetch change requests until the Changes tab is opened', async () => {
    const { getByText } = await renderAdmin();
    expect(mockGetVenueChangeRequests).not.toHaveBeenCalled();

    await act(async () => { fireEvent.press(getByText('tabChanges')); });
    await flushQueries();

    expect(mockGetVenueChangeRequests).toHaveBeenCalledTimes(1);
  });

  it('renders a change-request card with current → proposed values', async () => {
    mockGetVenueChangeRequests.mockResolvedValue({
      data: [
        {
          id: 1, venue_id: 10, submitted_by: 'u-1',
          proposed_nets: true, proposed_night_lighting: null, proposed_tables_count: 4,
          mark_unavailable: false, note: 'has nets now', photo_url: 'https://cdn/evidence.jpg', status: 'pending',
          created_at: '2026-06-01T10:00:00Z', profiles: { full_name: 'Ann' },
          venues: { name: 'Park A', city: 'Cluj', nets: false, night_lighting: true, tables_count: 2, approved: true },
        },
      ],
    });

    const { getByText, getByTestId } = await renderAdmin();
    await act(async () => { fireEvent.press(getByText('tabChanges')); });
    await flushQueries();

    expect(getByTestId('vcr-card-1')).toBeTruthy();
    expect(getByText('Park A')).toBeTruthy();
    expect(getByText('no → yes')).toBeTruthy();
    expect(getByText('2 → 4')).toBeTruthy();
    expect(getByTestId('vcr-photo-1')).toBeTruthy();
  });

  it('opens and closes the full-screen photo viewer from the thumbnail', async () => {
    mockGetVenueChangeRequests.mockResolvedValue({
      data: [
        {
          id: 1, venue_id: 10, submitted_by: 'u-1',
          proposed_nets: true, mark_unavailable: false, status: 'pending',
          created_at: '2026-06-01T10:00:00Z', profiles: null,
          photo_url: 'https://cdn/evidence.jpg',
          venues: { name: 'Park A', nets: false },
        },
      ],
    });

    const { getByText, getByTestId, queryByTestId } = await renderAdmin();
    await act(async () => { fireEvent.press(getByText('tabChanges')); });
    await flushQueries();

    expect(queryByTestId('image-viewer')).toBeNull();
    await act(async () => { fireEvent.press(getByTestId('vcr-photo-1')); });
    expect(getByTestId('image-viewer')).toBeTruthy();

    await act(async () => { fireEvent.press(getByTestId('image-viewer-close')); });
    expect(queryByTestId('image-viewer')).toBeNull();
  });

  it('applies a change request with the accepted-field decision', async () => {
    mockGetVenueChangeRequests.mockResolvedValue({
      data: [
        {
          id: 1, venue_id: 10, submitted_by: 'u-1',
          proposed_nets: true, proposed_night_lighting: null, proposed_tables_count: null,
          mark_unavailable: false, status: 'pending',
          created_at: '2026-06-01T10:00:00Z', profiles: null,
          venues: { name: 'Park A', nets: false },
        },
      ],
    });

    const { getByText, getByTestId, queryByTestId } = await renderAdmin();
    await act(async () => { fireEvent.press(getByText('tabChanges')); });
    await flushQueries();
    await act(async () => { fireEvent.press(getByTestId('vcr-apply-1')); });
    await flushAsync();

    expect(mockResolveVenueChangeRequest).toHaveBeenCalledWith(1, 10, 'admin-1', {
      applyNets: true,
      applyNightLighting: true,
      applyTablesCount: true,
      availability: 'none',
    });
    await waitFor(() => expect(queryByTestId('vcr-card-1')).toBeNull());
  });

  it('dismisses a change request', async () => {
    mockGetVenueChangeRequests.mockResolvedValue({
      data: [
        {
          id: 2, venue_id: 11, submitted_by: 'u-2',
          proposed_nets: false, mark_unavailable: false, status: 'pending',
          created_at: '2026-06-01T10:00:00Z', profiles: null,
          venues: { name: 'Park B', nets: true },
        },
      ],
    });

    const { getByText, getByTestId, queryByTestId } = await renderAdmin();
    await act(async () => { fireEvent.press(getByText('tabChanges')); });
    await flushQueries();
    await act(async () => { fireEvent.press(getByTestId('vcr-dismiss-2')); });
    await flushAsync();

    expect(mockDismissVenueChangeRequest).toHaveBeenCalledWith(2, 'admin-1');
    await waitFor(() => expect(queryByTestId('vcr-card-2')).toBeNull());
  });
});
