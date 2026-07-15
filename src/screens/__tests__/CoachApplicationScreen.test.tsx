// F063: the "I coach" application form → apply_to_coach.
jest.unmock('@tanstack/react-query');

import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CoachApplicationScreen } from '../CoachApplicationScreen';

let queryClient: QueryClient;

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
}));

jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({ user: { id: 'me-1' } }),
}));

const mockS = jest.fn((key: string, ...args: string[]) =>
  args.length ? `${key}:${args.join(',')}` : key,
);
jest.mock('../../hooks/useI18n', () => ({ useI18n: () => ({ s: mockS }) }));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: require('../../theme').lightColors, isDark: false }),
}));

jest.mock('../../components/Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

// The venue picker is exercised separately; stub it out here.
jest.mock('../../components/VenuePickerModal', () => ({
  VenuePickerModal: () => null,
}));

const mockShowAlert = jest.fn();
jest.mock('../../lib/dialogs', () => ({
  showAlert: (...args: any[]) => mockShowAlert(...args),
}));

const mockApplyToCoach = jest.fn();
const mockGetCoachProfile = jest.fn();
const mockGetCoachVenues = jest.fn().mockResolvedValue({ data: [], error: null });
jest.mock('../../services/coaches', () => ({
  applyToCoach: (...args: any[]) => mockApplyToCoach(...args),
  getCoachProfile: (...args: any[]) => mockGetCoachProfile(...args),
  getCoachVenues: (...args: any[]) => mockGetCoachVenues(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockGetCoachProfile.mockResolvedValue({ data: null, error: null });
  mockApplyToCoach.mockResolvedValue({ data: 1, error: null });
});

afterEach(() => queryClient.clear());

function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <CoachApplicationScreen />
    </QueryClientProvider>,
  );
}

describe('CoachApplicationScreen (F063)', () => {
  it('blocks submit with an empty bio', async () => {
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('coach-submit')).toBeTruthy());
    await act(async () => { fireEvent.press(getByTestId('coach-submit')); });
    expect(mockShowAlert).toHaveBeenCalled();
    expect(mockApplyToCoach).not.toHaveBeenCalled();
  });

  it('submits the application with the selected fields', async () => {
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('coach-bio-input')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(getByTestId('coach-bio-input'), 'I coach beginners');
      fireEvent.changeText(getByTestId('coach-experience-input'), '10 years');
      fireEvent.changeText(getByTestId('coach-price-input'), '30-50/h');
      fireEvent.changeText(getByTestId('coach-contact-input'), 'me@x.com');
    });
    await act(async () => {
      fireEvent.press(getByTestId('coach-level-beginner'));
      fireEvent.press(getByTestId('coach-language-en'));
    });
    await act(async () => { fireEvent.press(getByTestId('coach-submit')); });

    await waitFor(() => expect(mockApplyToCoach).toHaveBeenCalled());
    expect(mockApplyToCoach).toHaveBeenCalledWith('me-1', expect.objectContaining({
      bio: 'I coach beginners',
      experience: '10 years',
      priceRange: '30-50/h',
      contact: 'me@x.com',
      levels: ['beginner'],
      languages: ['en'],
      venueIds: [],
    }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('shows the status banner when an application already exists', async () => {
    mockGetCoachProfile.mockResolvedValue({
      data: {
        id: 1, user_id: 'me-1', status: 'pending', bio: 'hi', experience: null,
        levels: [], languages: [], price_range: null, contact: null,
        created_at: '2026-06-01T00:00:00Z',
      },
      error: null,
    });
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('coach-status-banner')).toBeTruthy());
  });
});
