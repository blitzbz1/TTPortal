import React from 'react';
import { render } from '@testing-library/react-native';

// --- Mocks ---

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
      headerShown?: boolean;
      headerRight?: () => React.ReactNode;
    };
  }) => {
    const headerRight = screenOptions?.headerRight?.();
    return (
      <View testID="tabs-navigator">
        <Text testID="header-shown">
          {String(screenOptions?.headerShown ?? true)}
        </Text>
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
      push: jest.fn(),
    }),
  };
});

jest.mock('../../../hooks/useSession', () => ({
  useSession: () => ({ session: { user: { id: 'test-user' } }, user: { id: 'test-user' }, isLoading: false }),
}));

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

jest.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../../theme').lightColors,
    mode: 'light',
    resolved: 'light',
    isDark: false,
    setMode: jest.fn(),
  }),
}));

 
import TabLayout from '../_layout';

describe('Header Integration — tab layout without header', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the Tabs navigator with headerShown false', () => {
    const { getByTestId } = render(<TabLayout />);

    getByTestId('tabs-navigator');
    const headerShown = getByTestId('header-shown');
    expect(headerShown.props.children).toBe('false');
  });

  it('does not render a header-right container since headers are hidden', () => {
    const { queryByTestId } = render(<TabLayout />);

    expect(queryByTestId('header-right-container')).toBeNull();
  });

  it('renders all 4 tab screens correctly without headers', () => {
    const { getAllByTestId } = render(<TabLayout />);

    const tabScreens = getAllByTestId(/^tab-screen-/);
    expect(tabScreens).toHaveLength(4);
  });
});
