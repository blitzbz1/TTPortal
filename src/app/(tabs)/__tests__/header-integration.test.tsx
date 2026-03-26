import React from 'react';
import { render, userEvent, within } from '@testing-library/react-native';

// --- Mocks ---

const mockUseSession = jest.fn();
jest.mock('../../../hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { View, Text } = require('react-native');

  const TabsScreen = ({
    name,
    options,
  }: {
    name: string;
    options: {
      title: string;
      tabBarIcon?: (props: { color: string }) => React.ReactNode;
    };
  }) => {
    const icon = options.tabBarIcon?.({ color: '#test-color' });
    return (
      <View testID={`tab-screen-${name}`}>
        <Text>{options.title}</Text>
        {icon}
      </View>
    );
  };

  const TabsComponent = ({
    children,
    screenOptions,
  }: {
    children: React.ReactNode;
    screenOptions: {
      headerRight?: () => React.ReactNode;
    };
  }) => {
    const headerRight = screenOptions?.headerRight?.();
    return (
      <View testID="tabs-navigator">
        {headerRight && (
          <View testID="header-right-container">{headerRight}</View>
        )}
        {children}
      </View>
    );
  };

  TabsComponent.Screen = TabsScreen;

  return {
    Tabs: TabsComponent,
    useRouter: () => ({
      push: (...args: unknown[]) => mockPush(...args),
    }),
  };
});

jest.mock('../../../components/Icon', () => {
  const { View } = require('react-native');
  return {
    Lucide: ({
      name,
      size,
      color,
    }: {
      name: string;
      size: number;
      color: string;
    }) => (
      <View
        testID={`lucide-icon-${name}`}
        accessibilityHint={`size:${size},color:${color}`}
      />
    ),
  };
});

jest.mock('../../../hooks/useI18n', () => ({
  useI18n: () => ({
    s: (key: string) => {
      const strings: Record<string, string> = {
        logout: 'Deconectare',
      };
      return strings[key] || key;
    },
  }),
}));

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    track: jest.fn(),
  },
}));

// Import TabLayout AFTER mocks — uses real HeaderProfileIcon
// eslint-disable-next-line import/first
import TabLayout from '../_layout';

describe('Header Integration — HeaderProfileIcon in tab layout', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('anonymous state', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        session: null,
        user: null,
        isLoading: false,
        signOut: jest.fn(),
      });
    });

    it('renders HeaderProfileIcon in the header-right area', () => {
      const { getByTestId } = render(<TabLayout />);

      getByTestId('header-right-container');
      getByTestId('header-profile-icon');
    });

    it('renders a generic user icon (not initials) when anonymous', () => {
      const { getByTestId, queryByTestId } = render(<TabLayout />);

      // Scope queries to the header-right area only
      const headerRight = getByTestId('header-right-container');
      const headerScope = within(headerRight);

      // Inside header-right, should find the Lucide user icon (anonymous state)
      headerScope.getByTestId('lucide-icon-user');

      // Should NOT render an initials circle
      expect(queryByTestId('initials-circle')).toBeNull();
    });

    it('navigates to /sign-in when anonymous user taps the profile icon', async () => {
      const { getByTestId } = render(<TabLayout />);

      const profileIcon = getByTestId('header-profile-icon');
      await user.press(profileIcon);

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/sign-in');
    });
  });

  describe('authenticated state', () => {
    const mockSignOut = jest.fn().mockResolvedValue({ error: null });

    beforeEach(() => {
      mockUseSession.mockReturnValue({
        session: {
          access_token: 'test-token',
          user: {
            id: 'user-1',
            email: 'maria@example.com',
            user_metadata: { full_name: 'Maria Ionescu' },
          },
        },
        user: {
          id: 'user-1',
          email: 'maria@example.com',
          user_metadata: { full_name: 'Maria Ionescu' },
        },
        isLoading: false,
        signOut: mockSignOut,
      });
    });

    it('renders initials circle with correct initials in the header', () => {
      const { getByTestId, getByText } = render(<TabLayout />);

      getByTestId('header-right-container');
      getByTestId('initials-circle');
      expect(getByText('MI')).toBeTruthy();
    });

    it('uses Colors.green background (#14532d) and Colors.white text (#ffffff) for initials', () => {
      const { getByTestId } = render(<TabLayout />);

      const initialsCircle = getByTestId('initials-circle');
      const circleStyle = Array.isArray(initialsCircle.props.style)
        ? Object.assign({}, ...initialsCircle.props.style)
        : initialsCircle.props.style;
      expect(circleStyle.backgroundColor).toBe('#14532d');

      const initialsText = getByTestId('initials-text');
      const textStyle = Array.isArray(initialsText.props.style)
        ? Object.assign({}, ...initialsText.props.style)
        : initialsText.props.style;
      expect(textStyle.color).toBe('#ffffff');
    });

    it('does not navigate to /sign-in when authenticated user taps the icon', async () => {
      const { getByTestId } = render(<TabLayout />);

      const profileIcon = getByTestId('header-profile-icon');
      await user.press(profileIcon);

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('opens the profile popover on tap showing user name and sign-out', async () => {
      const { getByTestId, getByText, queryByText } = render(<TabLayout />);

      // Popover should not be visible initially
      expect(queryByText('Maria Ionescu')).toBeNull();
      expect(queryByText('Deconectare')).toBeNull();

      const profileIcon = getByTestId('header-profile-icon');
      await user.press(profileIcon);

      // Popover should now be visible with user name and sign-out button
      expect(getByText('Maria Ionescu')).toBeTruthy();
      expect(getByText('Deconectare')).toBeTruthy();
      getByTestId('profile-popover');
    });
  });
});
