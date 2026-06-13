import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { OnboardingScreen } from '../OnboardingScreen';

const mockReplace = jest.fn();
let mockSearchParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: (...a: unknown[]) => mockReplace(...a) }),
  useLocalSearchParams: () => mockSearchParams,
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

jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({ user: { id: 'u1' } }),
}));

const mockUpdateProfile = jest.fn((..._args: unknown[]) => Promise.resolve({ error: null }));
jest.mock('../../services/profiles', () => ({
  updateProfile: (...a: unknown[]) => mockUpdateProfile(...a),
}));

jest.mock('../../components/Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

jest.mock('../../components/CityPickerModal', () => ({
  CityPickerModal: () => null,
}));

jest.mock('../../lib/haptics', () => ({
  hapticLight: jest.fn(),
  hapticSelection: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = {};
  mockS.mockImplementation((key: string) => key);
});

describe('OnboardingScreen', () => {
  it('renders the first step (welcome) by default', () => {
    const { getByText } = render(<OnboardingScreen />);
    expect(getByText('onboardingWelcome')).toBeTruthy();
    expect(getByText('onboardingSelectCity')).toBeTruthy();
  });

  it('advances to step 2 (play profile) when continue is pressed', () => {
    const { getByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('onboardingContinue'));
    expect(getByText('onboardingPlayProfileTitle')).toBeTruthy();
  });

  it('advances to step 3 (done) from step 2', () => {
    const { getByText } = render(<OnboardingScreen />);
    // Step 1 -> 2
    fireEvent.press(getByText('onboardingContinue'));
    // Step 2 -> 3
    fireEvent.press(getByText('onboardingContinue'));
    expect(getByText('onboardingReadyTitle')).toBeTruthy();
  });

  it('navigates to tabs when "start" is pressed on final step', () => {
    const { getByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('onboardingContinue'));
    fireEvent.press(getByText('onboardingContinue'));
    fireEvent.press(getByText('onboardingStart'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('skip navigates to tabs from any step', () => {
    const { getByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('onboardingSkip'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('finishes to the returnTo route — resumes the interrupted action (T062)', () => {
    mockSearchParams = { returnTo: '/venue/42' };
    const { getByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('onboardingContinue'));
    fireEvent.press(getByText('onboardingContinue'));
    fireEvent.press(getByText('onboardingStart'));
    expect(mockReplace).toHaveBeenCalledWith('/venue/42');
  });

  it('skip also honors returnTo (T062)', () => {
    mockSearchParams = { returnTo: '/venue/42' };
    const { getByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('onboardingSkip'));
    expect(mockReplace).toHaveBeenCalledWith('/venue/42');
  });

  it('sanitizes hostile returnTo values to the tabs root', () => {
    mockSearchParams = { returnTo: 'https://evil.example' };
    const { getByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('onboardingSkip'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('persists the selected skill level + goals on finish (F001)', () => {
    const { getByText, getByTestId } = render(<OnboardingScreen />);
    fireEvent.press(getByText('onboardingContinue')); // welcome -> play profile
    fireEvent.press(getByTestId('skill-club'));
    fireEvent.press(getByTestId('goal-doubles'));
    fireEvent.press(getByText('onboardingContinue')); // play profile -> ready
    fireEvent.press(getByText('onboardingStart'));
    expect(mockUpdateProfile).toHaveBeenCalledWith('u1', {
      skill_level: 'club',
      play_goals: ['doubles'],
    });
  });
});
