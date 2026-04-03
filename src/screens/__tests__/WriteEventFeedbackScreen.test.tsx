import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
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

const mockUseSession = jest.fn();
jest.mock('../../hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

const mockCreateFeedback = jest.fn();
const mockGetUserFeedback = jest.fn();
jest.mock('../../services/eventFeedback', () => ({
  createEventFeedback: (...args: any[]) => mockCreateFeedback(...args),
  getUserEventFeedback: (...args: any[]) => mockGetUserFeedback(...args),
}));

const mockSupabaseFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockSupabaseFrom(...args) },
}));

jest.mock('../../components/Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

jest.mock('../../lib/haptics', () => ({
  hapticLight: jest.fn(),
  hapticSuccess: jest.fn(),
}));

import { WriteEventFeedbackScreen } from '../WriteEventFeedbackScreen';

const mockDismiss = jest.fn();

function setupMocks(overrides?: { alreadySubmitted?: boolean }) {
  mockUseSession.mockReturnValue({
    user: { id: 'u-1', user_metadata: { full_name: 'Test User' } },
  });

  mockGetUserFeedback.mockResolvedValue({
    data: overrides?.alreadySubmitted ? { id: 1 } : null,
  });

  mockCreateFeedback.mockResolvedValue({ data: { id: 1 }, error: null });

  const eventChain: any = {
    select: jest.fn(() => eventChain),
    eq: jest.fn(() => eventChain),
    single: jest.fn(() => Promise.resolve({ data: { title: 'Test Event' }, error: null })),
  };
  mockSupabaseFrom.mockReturnValue(eventChain);
}

function renderModal(eventId: number = 5) {
  return render(
    <WriteEventFeedbackScreen visible={true} eventId={eventId} onDismiss={mockDismiss} />,
  );
}

describe('WriteEventFeedbackScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockS.mockImplementation((key: string) => key);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  // ── Rendering ──

  it('renders the feedback form with title, stars, hours input, and text area', async () => {
    setupMocks();
    const { getByText, getByPlaceholderText } = renderModal();

    expect(getByText('eventFeedbackTitle')).toBeTruthy();
    await waitFor(() => expect(getByText('Test Event')).toBeTruthy());
    expect(getByText('fieldRating')).toBeTruthy();
    expect(getByText('hoursPlayed')).toBeTruthy();
    expect(getByPlaceholderText('hoursPlayedPlaceholder')).toBeTruthy();
    expect(getByText('feedbackReview')).toBeTruthy();
  });

  it('renders hour preset chips', () => {
    setupMocks();
    const { getByText } = renderModal();

    expect(getByText('1h')).toBeTruthy();
    expect(getByText('1.5h')).toBeTruthy();
    expect(getByText('2h')).toBeTruthy();
    expect(getByText('3h')).toBeTruthy();
  });

  it('renders 5 star rating buttons', () => {
    setupMocks();
    const { getAllByText } = renderModal();

    const stars = getAllByText('\u2605');
    expect(stars).toHaveLength(5);
  });

  it('returns null when not visible', () => {
    setupMocks();
    const { toJSON } = render(
      <WriteEventFeedbackScreen visible={false} eventId={null} onDismiss={mockDismiss} />,
    );
    expect(toJSON()).toBeNull();
  });

  // ── Already submitted ──

  it('shows already-submitted message when feedback exists', async () => {
    setupMocks({ alreadySubmitted: true });
    const { findByText } = renderModal();

    const msg = await findByText('feedbackAlreadySent');
    expect(msg).toBeTruthy();
  });

  // ── Hour preset selection ──

  it('sets hours when a preset chip is tapped', () => {
    setupMocks();
    const { getByText, getByPlaceholderText } = renderModal();

    fireEvent.press(getByText('2h'));

    const input = getByPlaceholderText('hoursPlayedPlaceholder');
    expect(input.props.value).toBe('2');
  });

  // ── Validation ──

  it('shows error alert when submitting without hours', () => {
    setupMocks();
    const { getByText } = renderModal();

    fireEvent.press(getByText('publish'));

    expect(Alert.alert).toHaveBeenCalledWith('error', 'feedbackRequired');
    expect(mockCreateFeedback).not.toHaveBeenCalled();
  });

  // ── Successful submission ──

  it('submits feedback with correct data', async () => {
    setupMocks();
    const { getByText, getByPlaceholderText } = renderModal();

    fireEvent.press(getByText('2h'));
    fireEvent.changeText(getByPlaceholderText('...'), 'Was fun!');
    fireEvent.press(getByText('publish'));

    await waitFor(() => {
      expect(mockCreateFeedback).toHaveBeenCalledWith({
        event_id: 5,
        user_id: 'u-1',
        reviewer_name: 'Test User',
        rating: 4,
        hours_played: 2,
        body: 'Was fun!',
      });
    });

    expect(Alert.alert).toHaveBeenCalledWith('success', 'feedbackSubmitted');
    expect(mockDismiss).toHaveBeenCalled();
  });

  it('submits with null body when text is empty', async () => {
    setupMocks();
    const { getByText } = renderModal();

    fireEvent.press(getByText('1.5h'));
    fireEvent.press(getByText('publish'));

    await waitFor(() => {
      expect(mockCreateFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ body: null, hours_played: 1.5 }),
      );
    });
  });

  // ── Error handling ──

  it('shows error alert when submission fails', async () => {
    setupMocks();
    mockCreateFeedback.mockResolvedValue({
      data: null,
      error: { message: 'Server error' },
    });

    const { getByText } = renderModal();

    fireEvent.press(getByText('2h'));
    fireEvent.press(getByText('publish'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('error', expect.any(String));
    });
    expect(mockDismiss).not.toHaveBeenCalled();
  });

  // ── Dismiss ──

  it('calls onDismiss when close button is pressed', () => {
    setupMocks();
    const { getByTestId } = renderModal();

    fireEvent.press(getByTestId('icon-x'));
    expect(mockDismiss).toHaveBeenCalled();
  });

  it('calls onDismiss when cancel button is pressed', () => {
    setupMocks();
    const { getByText } = renderModal();

    fireEvent.press(getByText('cancel'));
    expect(mockDismiss).toHaveBeenCalled();
  });
});
