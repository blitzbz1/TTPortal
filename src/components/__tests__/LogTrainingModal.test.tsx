import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { LogTrainingModal } from '../LogTrainingModal';

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
  hapticLight: jest.fn(),
  hapticSuccess: jest.fn(),
}));

const mockShowAlert = jest.fn();
jest.mock('../../lib/dialogs', () => ({ showAlert: (...a: any[]) => mockShowAlert(...a) }));

jest.mock('../../lib/auth-utils', () => ({
  safeErrorMessage: (_e: any, fallback: string) => fallback,
}));

jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({ user: { id: 'u1' } }),
}));

const mockLogTraining = jest.fn();
jest.mock('../../services/training', () => ({
  logTraining: (...a: any[]) => mockLogTraining(...a),
}));

const mockGetFriends = jest.fn();
jest.mock('../../services/friends', () => ({
  getFriends: (...a: any[]) => mockGetFriends(...a),
}));

// react-native-keyboard-controller's KeyboardAwareScrollView -> a plain ScrollView.
jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = require('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockColors = new Proxy({}, { get: () => '#000000' });

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTheme.mockReturnValue({ colors: mockColors });
  mockS.mockImplementation((key: string) => key);
  mockLogTraining.mockResolvedValue({ data: { id: 1 }, error: null });
  mockGetFriends.mockResolvedValue({ data: [] });
});

describe('LogTrainingModal', () => {
  it('does not render when not visible', () => {
    const { queryByText } = render(<LogTrainingModal visible={false} onDismiss={jest.fn()} />);
    expect(queryByText('trainingLogTitle')).toBeNull();
  });

  it('renders the four session-type chips and focus areas', () => {
    const { getByTestId } = render(<LogTrainingModal visible onDismiss={jest.fn()} />);
    expect(getByTestId('training-type-solo')).toBeTruthy();
    expect(getByTestId('training-type-partner')).toBeTruthy();
    expect(getByTestId('training-type-multiball')).toBeTruthy();
    expect(getByTestId('training-type-robot')).toBeTruthy();
    expect(getByTestId('training-focus-serves')).toBeTruthy();
    expect(getByTestId('training-focus-match_play')).toBeTruthy();
  });

  it('blocks submit with no duration', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(<LogTrainingModal visible onDismiss={onDismiss} />);
    fireEvent.press(getByTestId('training-focus-serves'));
    fireEvent.press(getByTestId('training-save'));
    expect(mockShowAlert).toHaveBeenCalledWith('error', 'trainingDurationError');
    expect(mockLogTraining).not.toHaveBeenCalled();
  });

  it('blocks submit when no focus area is selected', () => {
    const { getByTestId } = render(<LogTrainingModal visible onDismiss={jest.fn()} />);
    fireEvent.changeText(getByTestId('training-hours'), '2');
    fireEvent.press(getByTestId('training-save'));
    expect(mockShowAlert).toHaveBeenCalledWith('error', 'trainingFocusError');
    expect(mockLogTraining).not.toHaveBeenCalled();
  });

  it('caps focus selection at three', () => {
    const { getByTestId } = render(<LogTrainingModal visible onDismiss={jest.fn()} />);
    fireEvent.press(getByTestId('training-focus-serves'));
    fireEvent.press(getByTestId('training-focus-receive'));
    fireEvent.press(getByTestId('training-focus-footwork'));
    // A 4th press is rejected (disabled). The chip is still not selected.
    fireEvent.press(getByTestId('training-focus-blocking'));
    fireEvent.changeText(getByTestId('training-hours'), '2');
    fireEvent.press(getByTestId('training-save'));
    expect(mockLogTraining).toHaveBeenCalledWith(
      expect.objectContaining({ focus: ['serves', 'receive', 'footwork'] }),
    );
  });

  it('logs a session with type, duration, and focus, then dismisses', async () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <LogTrainingModal visible venueId={42} venueName="Club X" onDismiss={onDismiss} />,
    );
    fireEvent.press(getByTestId('training-type-robot'));
    fireEvent.changeText(getByTestId('training-hours'), '1.5');
    fireEvent.press(getByTestId('training-focus-footwork'));
    fireEvent.press(getByTestId('training-save'));

    await waitFor(() => {
      expect(mockLogTraining).toHaveBeenCalledWith({
        user_id: 'u1',
        session_type: 'robot',
        hours: 1.5,
        focus: ['footwork'],
        venue_id: 42,
        partner_id: null,
        note: null,
      });
    });
    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
  });
});
