import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { OnboardingScreen } from '../OnboardingScreen';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: (...a: unknown[]) => mockReplace(...a) }),
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
  mockS.mockImplementation((key: string) => key);
});

describe('OnboardingScreen', () => {
  it('renders the first step (welcome) by default', () => {
    const { getByText } = render(<OnboardingScreen />);
    expect(getByText('onboardingWelcome')).toBeTruthy();
    expect(getByText('onboardingSelectCity')).toBeTruthy();
  });

  it('advances to step 2 (interests) when continue is pressed', () => {
    const { getByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('onboardingContinue'));
    expect(getByText('onboardingInterestsTitle')).toBeTruthy();
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
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/');
  });

  it('skip navigates to tabs from any step', () => {
    const { getByText } = render(<OnboardingScreen />);
    fireEvent.press(getByText('onboardingSkip'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/');
  });
});
