// F063: the Coaches moderation tab — admin-only, lazy query, approve + reject.
// Runs against a real QueryClient like the sibling AdminModerationScreen suite.
jest.unmock('@tanstack/react-query');

import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminModerationScreen } from '../AdminModerationScreen';

let queryClient: QueryClient;

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({ user: { id: 'admin-1', user_metadata: { full_name: 'Admin' } } }),
}));

const mockS = jest.fn((key: string) => key);
jest.mock('../../hooks/useI18n', () => ({ useI18n: () => ({ s: mockS }) }));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: require('../../theme').lightColors, isDark: false }),
}));

jest.mock('../../hooks/queries/useCitiesQuery', () => ({
  citiesQueryKey: ['cities', 'delta'],
  useCitiesQuery: () => ({ data: [] }),
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

const mockGetPendingCoaches = jest.fn();
const mockApproveCoach = jest.fn();
const mockRejectCoach = jest.fn();

jest.mock('../../services/admin', () => ({
  // The other tabs' getters resolve empty; only the coach trio matters here.
  getPendingVenues: jest.fn().mockResolvedValue({ data: [] }),
  getFlaggedReviews: jest.fn().mockResolvedValue({ data: [] }),
  searchVenuesAdmin: jest.fn().mockResolvedValue({ data: [] }),
  updateVenue: jest.fn(),
  deleteVenue: jest.fn(),
  approveVenue: jest.fn(),
  rejectVenue: jest.fn(),
  keepReview: jest.fn(),
  deleteReview: jest.fn(),
  getUserFeedback: jest.fn().mockResolvedValue({ data: [] }),
  deleteUserFeedback: jest.fn(),
  getVenueChangeRequests: jest.fn().mockResolvedValue({ data: [] }),
  resolveVenueChangeRequest: jest.fn(),
  dismissVenueChangeRequest: jest.fn(),
  getFeedbackReplies: jest.fn().mockResolvedValue({ data: [] }),
  replyToFeedback: jest.fn().mockResolvedValue({ data: null, error: null }),
  getPendingCoaches: (...args: any[]) => mockGetPendingCoaches(...args),
  approveCoach: (...args: any[]) => mockApproveCoach(...args),
  rejectCoach: (...args: any[]) => mockRejectCoach(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockGetProfile.mockImplementation(() => ({
    then: (resolve: (v: { data: { is_admin: boolean } }) => void) => {
      resolve({ data: { is_admin: true } });
      return Promise.resolve({ data: { is_admin: true } });
    },
  }));
  mockGetPendingCoaches.mockResolvedValue({ data: [] });
});

afterEach(() => {
  queryClient.clear();
});

async function flushAsync(ticks = 3) {
  await act(async () => {
    for (let i = 0; i < ticks; i++) await new Promise((r) => setTimeout(r, 0));
  });
}

async function renderAdmin() {
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AdminModerationScreen />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(utils.getByText('tabReviews')).toBeTruthy());
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  await flushAsync();
  return utils;
}

const COACHES = [
  {
    id: 7,
    user_id: 'u-coach',
    status: 'pending',
    bio: 'I coach kids',
    experience: '10y',
    levels: ['beginner', 'youth'],
    languages: ['en', 'ro'],
    price_range: '30-50/h',
    contact: 'a@b.com',
    created_at: '2026-06-01T10:00:00Z',
    profiles: { full_name: 'Coach Cara' },
  },
];

describe('AdminModerationScreen — Coaches tab (F063)', () => {
  it('shows the Coaches tab for an admin', async () => {
    const { getByText } = await renderAdmin();
    expect(getByText('tabCoaches')).toBeTruthy();
  });

  it('does not fetch coaches until the Coaches tab is opened', async () => {
    const { getByText } = await renderAdmin();
    expect(mockGetPendingCoaches).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(getByText('tabCoaches')); });
    await waitFor(() => expect(mockGetPendingCoaches).toHaveBeenCalledTimes(1));
  });

  it('renders a pending coach card with bio/levels and actions', async () => {
    mockGetPendingCoaches.mockResolvedValue({ data: COACHES });
    const { getByText, getByTestId } = await renderAdmin();
    await act(async () => { fireEvent.press(getByText('tabCoaches')); });
    await waitFor(() => expect(getByTestId('coach-card-7')).toBeTruthy());
    expect(getByText('Coach Cara')).toBeTruthy();
    expect(getByText('approveCoach')).toBeTruthy();
    expect(getByText('rejectCoach')).toBeTruthy();
  });

  it('approves a coach and removes the card', async () => {
    mockGetPendingCoaches.mockResolvedValue({ data: COACHES });
    mockApproveCoach.mockResolvedValue({ data: { id: 7, status: 'approved' }, error: null });
    const { getByText, getByTestId, queryByTestId } = await renderAdmin();
    await act(async () => { fireEvent.press(getByText('tabCoaches')); });
    await waitFor(() => expect(getByTestId('coach-card-7')).toBeTruthy());

    await act(async () => { fireEvent.press(getByTestId('coach-approve-7')); });
    await flushAsync();

    expect(mockApproveCoach).toHaveBeenCalledWith(7, 'admin-1');
    await waitFor(() => expect(queryByTestId('coach-card-7')).toBeNull());
  });

  it('rejects a coach through the confirm sheet', async () => {
    mockGetPendingCoaches.mockResolvedValue({ data: COACHES });
    mockRejectCoach.mockResolvedValue({ data: { id: 7, status: 'rejected' }, error: null });
    const { getByText, getByTestId, queryByTestId } = await renderAdmin();
    await act(async () => { fireEvent.press(getByText('tabCoaches')); });
    await waitFor(() => expect(getByTestId('coach-card-7')).toBeTruthy());

    // Open the confirm sheet, then confirm.
    await act(async () => { fireEvent.press(getByTestId('coach-reject-7')); });
    await act(async () => { fireEvent.press(getByTestId('coach-confirm-reject')); });
    await flushAsync();

    expect(mockRejectCoach).toHaveBeenCalledWith(7, 'admin-1');
    await waitFor(() => expect(queryByTestId('coach-card-7')).toBeNull());
  });
});
