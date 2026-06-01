import React from 'react';
import { render, within } from '@testing-library/react-native';

// --- Mocks (must be defined before component import) ---

jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return { GestureHandlerRootView: View };
});

const mockUseSession = jest.fn();
const mockStackScreenNames: string[] = [];
let mockGlobalSearchParams: Record<string, string> = {};
let mockPathname = '/';
const mockUseSelectedLocation = jest.fn();

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

jest.mock('../../contexts/LocationProvider', () => {
  const { View } = require('react-native');
  return {
    LocationProvider: ({ children }: { children: React.ReactNode }) => (
      <View testID="location-provider">{children}</View>
    ),
  };
});

jest.mock('../../hooks/useSelectedLocation', () => ({
  useSelectedLocation: () => mockUseSelectedLocation(),
}));

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
  function MockScreen({ name }: { name: string }) {
    mockStackScreenNames.push(name);
    return null;
  }
  StackComponent.Screen = MockScreen;
  return {
    Stack: StackComponent,
    useGlobalSearchParams: () => mockGlobalSearchParams,
    usePathname: () => mockPathname,
    ErrorBoundary: () => null,
  };
});

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('react-native-reanimated', () => ({}));

jest.mock('../../components/AnimatedSplash', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => <View testID="animated-splash" />,
  };
});

jest.mock('../../components/InitialLocationSetupModal', () => {
  const { View } = require('react-native');
  return {
    InitialLocationSetupModal: ({ visible }: { visible: boolean }) => (
      visible ? <View testID="initial-location-setup-modal" /> : null
    ),
  };
});

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

 
import RootLayout from '../_layout';
 
import * as SplashScreen from 'expo-splash-screen';

describe('RootLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStackScreenNames.length = 0;
    mockUseSession.mockReturnValue({
      isLoading: false,
      session: null,
      user: null,
    });
    mockUseFonts.mockReturnValue([true, null]);
    mockGlobalSearchParams = {};
    mockPathname = '/';
    mockUseSelectedLocation.mockReturnValue({
      hasCompletedInitialLocationSetup: true,
      resetInitialLocationSetup: jest.fn(),
    });
  });

  describe('loading state', () => {
    it('shows animated splash overlay without Stack when session isLoading is true', () => {
      mockUseSession.mockReturnValue({
        isLoading: true,
        session: null,
        user: null,
      });

      const { getByTestId, queryByTestId } = render(<RootLayout />);

      getByTestId('animated-splash');
      expect(queryByTestId('stack-navigator')).toBeNull();
    });

    it('shows animated splash overlay without Stack when fonts are not yet loaded', () => {
      mockUseFonts.mockReturnValue([false, null]);

      const { getByTestId, queryByTestId } = render(<RootLayout />);

      getByTestId('animated-splash');
      expect(queryByTestId('stack-navigator')).toBeNull();
    });

    it('shows animated splash when both fonts and session are loading', () => {
      mockUseSession.mockReturnValue({
        isLoading: true,
        session: null,
        user: null,
      });
      mockUseFonts.mockReturnValue([false, null]);

      const { getByTestId, queryByTestId } = render(<RootLayout />);

      getByTestId('animated-splash');
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
    it('renders Stack navigator with overlay still mounted when ready', () => {
      const { getByTestId } = render(<RootLayout />);

      getByTestId('stack-navigator');
      // Overlay stays mounted until its fade-out completes and onComplete fires
      getByTestId('animated-splash');
    });

    it('registers venue detail route for restored /venue/:id navigation state', () => {
      render(<RootLayout />);

      expect(mockStackScreenNames).toContain('venue/[id]');
    });

    it('hides native splash screen once fully loaded', () => {
      render(<RootLayout />);

      expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    });

    it('renders initial location welcome instead of Stack when reset param is present', () => {
      mockGlobalSearchParams = { resetInitialLocation: '' };

      const { getByTestId, queryByTestId } = render(<RootLayout />);

      getByTestId('initial-location-setup-modal');
      expect(queryByTestId('stack-navigator')).toBeNull();
    });

    it('keeps reset password route visible even before initial location setup', () => {
      mockPathname = '/reset-password';
      mockUseSelectedLocation.mockReturnValueOnce({
        hasCompletedInitialLocationSetup: false,
        resetInitialLocationSetup: jest.fn(),
      });

      const { getByTestId, queryByTestId } = render(<RootLayout />);

      getByTestId('stack-navigator');
      expect(queryByTestId('initial-location-setup-modal')).toBeNull();
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
