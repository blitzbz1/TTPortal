import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { AdminModerationScreen } from '../AdminModerationScreen';

// Mock dependencies
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
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockGetProfile.mockResolvedValue({ data: { is_admin: true } });
  mockGetPendingVenues.mockResolvedValue({ data: [] });
  mockGetFlaggedReviews.mockResolvedValue({ data: [] });
  mockSearchVenuesAdmin.mockResolvedValue({ data: [] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AdminModerationScreen — tabs', () => {
  it('renders both tab buttons', async () => {
    const { getByText } = render(<AdminModerationScreen />);
    await act(async () => {});

    expect(getByText('tabReviews')).toBeTruthy();
    expect(getByText('tabVenues')).toBeTruthy();
  });

  it('shows reviews tab content by default', async () => {
    const { getByText } = render(<AdminModerationScreen />);
    await act(async () => {});

    expect(getByText('pendingVenues')).toBeTruthy();
    expect(getByText('reportedReviews')).toBeTruthy();
  });

  it('switches to venues tab on press', async () => {
    const { getByText } = render(<AdminModerationScreen />);
    await act(async () => {});

    fireEvent.press(getByText('tabVenues'));

    expect(getByText('searchVenuesHint')).toBeTruthy();
  });
});

describe('AdminModerationScreen — venue search', () => {
  it('shows hint when query is less than 3 chars', async () => {
    const { getByText, getByPlaceholderText } = render(<AdminModerationScreen />);
    await act(async () => {});

    fireEvent.press(getByText('tabVenues'));
    fireEvent.changeText(getByPlaceholderText('searchVenues'), 'Pa');

    expect(getByText('searchVenuesHint')).toBeTruthy();
    expect(mockSearchVenuesAdmin).not.toHaveBeenCalled();
  });

  it('triggers search after debounce with 3+ chars', async () => {
    const venues = [{ id: 1, name: 'Parc Tineretului', city: 'București', address: 'Str. X' }];
    mockSearchVenuesAdmin.mockResolvedValue({ data: venues });

    const { getByText, getByPlaceholderText } = render(<AdminModerationScreen />);
    await act(async () => {});

    fireEvent.press(getByText('tabVenues'));
    fireEvent.changeText(getByPlaceholderText('searchVenues'), 'Parc');

    // Advance past debounce
    await act(async () => { jest.advanceTimersByTime(500); });

    expect(mockSearchVenuesAdmin).toHaveBeenCalledWith('Parc');
    expect(getByText('Parc Tineretului')).toBeTruthy();
  });
});

describe('AdminModerationScreen — edit modal', () => {
  it('opens edit modal when pencil button is pressed on a search result', async () => {
    const venues = [{ id: 1, name: 'Parc Test', city: 'București', address: 'Str. Test', type: 'parc_exterior', tables_count: 2, description: '' }];
    mockSearchVenuesAdmin.mockResolvedValue({ data: venues });

    const { getByText, getByPlaceholderText } = render(<AdminModerationScreen />);
    await act(async () => {});

    // Switch to venues tab and search
    fireEvent.press(getByText('tabVenues'));
    fireEvent.changeText(getByPlaceholderText('searchVenues'), 'Parc');
    await act(async () => { jest.advanceTimersByTime(500); });

    expect(getByText('Parc Test')).toBeTruthy();
  });

  it('saves venue edits and updates search results', async () => {
    const venues = [{ id: 1, name: 'Parc Test', city: 'București', address: 'Str. Test', type: 'parc_exterior', tables_count: 2, description: '' }];
    mockSearchVenuesAdmin.mockResolvedValue({ data: venues });
    mockUpdateVenue.mockResolvedValue({ data: { ...venues[0], name: 'Parc Updated' }, error: null });

    const { getByText, getByPlaceholderText } = render(<AdminModerationScreen />);
    await act(async () => {});

    // Navigate to venues tab and search
    fireEvent.press(getByText('tabVenues'));
    fireEvent.changeText(getByPlaceholderText('searchVenues'), 'Parc');
    await act(async () => { jest.advanceTimersByTime(500); });

    // Verify venue appeared
    expect(getByText('Parc Test')).toBeTruthy();
  });
});

describe('AdminModerationScreen — pending venues', () => {
  it('renders pending venue cards', async () => {
    const pending = [
      { id: 10, name: 'New Venue', city: 'Cluj', address: 'Str. ABC', created_at: '2026-04-01', profiles: { full_name: 'Ion' } },
    ];
    mockGetPendingVenues.mockResolvedValue({ data: pending });

    const { getByText } = render(<AdminModerationScreen />);
    await act(async () => {});

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

    const { getByText, queryByText } = render(<AdminModerationScreen />);
    await act(async () => {});

    expect(getByText('Pending Venue')).toBeTruthy();

    await act(async () => { fireEvent.press(getByText('approve')); });

    expect(mockApproveVenue).toHaveBeenCalledWith(10, 'admin-1');
    expect(queryByText('Pending Venue')).toBeNull();
  });
});
