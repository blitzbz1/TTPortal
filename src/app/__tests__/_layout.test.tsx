import React from 'react';
import { render, within } from '@testing-library/react-native';

// --- Mocks (must be defined before component import) ---

jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return { GestureHandlerRootView: View };
});

const mockUseSession = jest.fn();

jest.mock('../../hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('../../contexts/SessionProvider', () => {
  const { View } = require('react-native');
  return {
    SessionProvider: ({ children }: { children: React.ReactNode }) => (
      <View testID="session-provider">{children}</View>
    ),
  };
});

jest.mock('../../contexts/I18nProvider', () => {
  const { View } = require('react-native');
  return {
    I18nProvider: ({ children }: { children: React.ReactNode }) => (
      <View testID="i18n-provider">{children}</View>
    ),
  };
});

const mockUseFonts = jest.fn<[boolean, Error | null], []>();
jest.mock('expo-font', () => ({
  useFonts: (...a: unknown[]) => mockUseFonts(...(a as [])),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

jest.mock('expo-router', () => {
  const { View } = require('react-native');
  const StackComponent = ({ children }: { children?: React.ReactNode }) => (
    <View testID="stack-navigator">{children}</View>
  );
  function MockScreen() { return null; }
  StackComponent.Screen = MockScreen;
  return {
    Stack: StackComponent,
    ErrorBoundary: () => null,
  };
});

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('react-native-reanimated', () => ({}));

jest.mock('../../contexts/NotificationProvider', () => {
  const { View } = require('react-native');
  return {
    NotificationProvider: ({ children }: { children: React.ReactNode }) => (
      <View testID="notification-provider">{children}</View>
    ),
  };
});

jest.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ unreadCount: 0, refreshUnreadCount: jest.fn() }),
}));

jest.mock('@expo-google-fonts/syne', () => ({
  Syne_400Regular: 'syne-400-asset',
  Syne_700Bold: 'syne-700-asset',
}));

jest.mock('@expo-google-fonts/dm-sans', () => ({
  DMSans_400Regular: 'dm-sans-400-asset',
  DMSans_500Medium: 'dm-sans-500-asset',
}));

// eslint-disable-next-line import/first
import RootLayout from '../_layout';
// eslint-disable-next-line import/first
import * as SplashScreen from 'expo-splash-screen';

describe('RootLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({
      isLoading: false,
      session: null,
      user: null,
    });
    mockUseFonts.mockReturnValue([true, null]);
  });

  describe('loading state', () => {
    it('shows splash view when session isLoading is true', () => {
      mockUseSession.mockReturnValue({
        isLoading: true,
        session: null,
        user: null,
      });

      const { getByTestId, queryByTestId } = render(<RootLayout />);

      getByTestId('splash-loading');
      expect(queryByTestId('stack-navigator')).toBeNull();
    });

    it('shows splash view when fonts are not yet loaded', () => {
      mockUseFonts.mockReturnValue([false, null]);

      const { getByTestId, queryByTestId } = render(<RootLayout />);

      getByTestId('splash-loading');
      expect(queryByTestId('stack-navigator')).toBeNull();
    });

    it('shows splash view when both fonts and session are loading', () => {
      mockUseSession.mockReturnValue({
        isLoading: true,
        session: null,
        user: null,
      });
      mockUseFonts.mockReturnValue([false, null]);

      const { getByTestId, queryByTestId } = render(<RootLayout />);

      getByTestId('splash-loading');
      expect(queryByTestId('stack-navigator')).toBeNull();
    });

    it('does not hide native splash screen while loading', () => {
      mockUseSession.mockReturnValue({
        isLoading: true,
        session: null,
        user: null,
      });

      render(<RootLayout />);

      expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    });
  });

  describe('loaded state', () => {
    it('renders Stack navigator when fonts loaded and session resolved', () => {
      const { getByTestId, queryByTestId } = render(<RootLayout />);

      getByTestId('stack-navigator');
      expect(queryByTestId('splash-loading')).toBeNull();
    });

    it('hides native splash screen once fully loaded', () => {
      render(<RootLayout />);

      expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('provider nesting order', () => {
    it('wraps app in SessionProvider → I18nProvider (Session outermost)', () => {
      const { getByTestId } = render(<RootLayout />);

      const sessionProvider = getByTestId('session-provider');
      const i18nProvider = within(sessionProvider).getByTestId(
        'i18n-provider',
      );

      // I18nProvider is inside SessionProvider
      expect(i18nProvider).toBe(getByTestId('i18n-provider'));
    });

    it('renders navigator content inside I18nProvider', () => {
      const { getByTestId } = render(<RootLayout />);

      const i18nProvider = getByTestId('i18n-provider');

      // Stack navigator should be inside I18nProvider
      within(i18nProvider).getByTestId('stack-navigator');
    });
  });
});
