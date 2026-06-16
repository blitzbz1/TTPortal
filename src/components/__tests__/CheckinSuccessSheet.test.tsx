import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { CheckinSuccessSheet } from '../CheckinSuccessSheet';
import { hapticSuccess } from '../../lib/haptics';

const mockUseTheme = jest.fn();
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => mockUseTheme(),
}));

const mockS = jest.fn((key: string) => key);
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({ s: mockS }),
}));

jest.mock('../Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

jest.mock('../../lib/haptics', () => ({
  hapticSuccess: jest.fn(),
}));

jest.mock('../../lib/dialogs', () => ({ showAlert: jest.fn() }));

const mockRequestPerms = jest.fn();
const mockLaunchLibrary = jest.fn();
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...a: any[]) => mockRequestPerms(...a),
  launchImageLibraryAsync: (...a: any[]) => mockLaunchLibrary(...a),
}));

const mockUploadMoment = jest.fn();
const mockPostMoment = jest.fn();
jest.mock('../../features/checkinMoments', () => ({
  uploadMomentImage: (...a: any[]) => mockUploadMoment(...a),
  postCheckinMoment: (...a: any[]) => mockPostMoment(...a),
}));

jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({ user: { id: 'u1' } }),
}));

const mockProfileStats = jest.fn();
const mockRefetchStats = jest.fn();
jest.mock('../../hooks/queries/useProfileQuery', () => ({
  useProfileStatsQuery: () => ({ data: mockProfileStats(), refetch: mockRefetchStats }),
}));

const mockColors = {
  bg: '#fafaf8',
  bgAlt: '#ffffff',
  bgMuted: '#f4f4ef',
  bgMid: '#ecece4',
  text: '#111810',
  textMuted: '#4a4f47',
  textFaint: '#9ca39a',
  textOnPrimary: '#ffffff',
  border: '#e2e4de',
  borderLight: '#eceee8',
  primary: '#14532d',
  primaryMid: '#166534',
  primaryLight: '#22c55e',
  primaryDim: '#dcfce7',
  primaryPale: '#f0fdf4',
  accent: '#c2410c',
  amberPale: '#fff7ed',
  red: '#ef4444',
  overlayHeavy: 'rgba(0,0,0,0.53)',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTheme.mockReturnValue({ colors: mockColors });
  mockS.mockImplementation((key: string) => key);
  mockRequestPerms.mockResolvedValue({ status: 'granted' });
  mockLaunchLibrary.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///pic.jpg', width: 1200, height: 900 }],
  });
  mockUploadMoment.mockResolvedValue({ ok: true, url: 'https://cdn/moments/me/1.jpg' });
  mockPostMoment.mockResolvedValue({ data: 5, error: null });
  mockProfileStats.mockReturnValue({ current_streak: 0, best_streak: 0 });
});

describe('CheckinSuccessSheet', () => {
  it('does not render when not visible', () => {
    const { queryByText } = render(
      <CheckinSuccessSheet
        visible={false}
        venueName="Test Venue"
        onDismiss={jest.fn()}
      />,
    );
    expect(queryByText('checkinSuccess')).toBeNull();
  });

  it('renders venue name and success message when visible', () => {
    const { getByText } = render(
      <CheckinSuccessSheet
        visible={true}
        venueName="ClubPing Bucuresti"
        onDismiss={jest.fn()}
      />,
    );
    expect(getByText('checkinSuccess')).toBeTruthy();
    expect(getByText('ClubPing Bucuresti')).toBeTruthy();
  });

  it('shows end time when provided', () => {
    const { getByText } = render(
      <CheckinSuccessSheet
        visible={true}
        venueName="Test"
        endTime="15:30"
        onDismiss={jest.fn()}
      />,
    );
    expect(getByText('untilTime 15:30')).toBeTruthy();
  });

  it('shows XP text', () => {
    const { getByText } = render(
      <CheckinSuccessSheet
        visible={true}
        venueName="Test"
        onDismiss={jest.fn()}
      />,
    );
    expect(getByText('+10 XP')).toBeTruthy();
  });

  it('calls onDismiss when dismiss button is pressed', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <CheckinSuccessSheet
        visible={true}
        venueName="Test"
        onDismiss={onDismiss}
      />,
    );
    fireEvent.press(getByTestId('checkin-success-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('triggers haptic feedback when shown', () => {
    render(
      <CheckinSuccessSheet
        visible={true}
        venueName="Test"
        onDismiss={jest.fn()}
      />,
    );
    expect(hapticSuccess).toHaveBeenCalledTimes(1);
  });

  describe('Weekly streak line (F050)', () => {
    it('hides the streak line when there is no active streak', () => {
      mockProfileStats.mockReturnValue({ current_streak: 0, best_streak: 0 });
      const { queryByTestId } = render(
        <CheckinSuccessSheet visible venueName="Test" onDismiss={jest.fn()} />,
      );
      expect(queryByTestId('checkin-streak-row')).toBeNull();
    });

    it('shows the "keep it alive" streak line when the streak is active', () => {
      mockProfileStats.mockReturnValue({ current_streak: 6, best_streak: 6 });
      const { getByTestId } = render(
        <CheckinSuccessSheet visible venueName="Test" onDismiss={jest.fn()} />,
      );
      expect(getByTestId('checkin-streak-row')).toBeTruthy();
    });

    it('refetches the profile stats when the sheet opens', () => {
      mockProfileStats.mockReturnValue({ current_streak: 2, best_streak: 4 });
      render(<CheckinSuccessSheet visible venueName="Test" onDismiss={jest.fn()} />);
      expect(mockRefetchStats).toHaveBeenCalled();
    });
  });

  describe('Add a moment (F042)', () => {
    it('hides the moment action without a check-in id (e.g. offline)', () => {
      const { queryByTestId } = render(
        <CheckinSuccessSheet visible venueName="Test" venueId={42} queuedOffline onDismiss={jest.fn()} />,
      );
      expect(queryByTestId('checkin-add-moment')).toBeNull();
    });

    it('shows the moment action when a fresh check-in id is provided', () => {
      const { getByTestId } = render(
        <CheckinSuccessSheet visible venueName="Test" venueId={42} checkinId={7} onDismiss={jest.fn()} />,
      );
      expect(getByTestId('checkin-add-moment')).toBeTruthy();
    });

    it('uploads + posts a moment for the check-in', async () => {
      const onMomentPosted = jest.fn();
      const { getByTestId, findByTestId } = render(
        <CheckinSuccessSheet
          visible
          venueName="Test"
          venueId={42}
          checkinId={7}
          onMomentPosted={onMomentPosted}
          onDismiss={jest.fn()}
        />,
      );
      fireEvent.press(getByTestId('checkin-add-moment'));
      // Preview + caption appear after picking.
      const caption = await findByTestId('checkin-moment-caption');
      fireEvent.changeText(caption, 'great rallies');
      fireEvent.press(getByTestId('checkin-moment-post'));

      await waitFor(() =>
        expect(mockUploadMoment).toHaveBeenCalledWith({ uri: 'file:///pic.jpg', width: 1200, height: 900 }),
      );
      await waitFor(() =>
        expect(mockPostMoment).toHaveBeenCalledWith(7, 42, 'https://cdn/moments/me/1.jpg', 'great rallies'),
      );
      expect(onMomentPosted).toHaveBeenCalled();
    });
  });
});
