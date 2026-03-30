import React from 'react';
import { render } from '@testing-library/react-native';

// --- Mocks (must be defined before component import) ---

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
        <Text testID={`tab-label-${name}`}>{options.title}</Text>
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
      tabBarActiveTintColor?: string;
      tabBarInactiveTintColor?: string;
      tabBarLabelStyle?: Record<string, unknown>;
    };
  }) => {
    return (
      <View testID="tabs-navigator">
        <View testID="screen-options">
          <Text testID="header-shown">
            {String(screenOptions?.headerShown ?? true)}
          </Text>
          <Text testID="active-tint-color">
            {screenOptions?.tabBarActiveTintColor}
          </Text>
          <Text testID="inactive-tint-color">
            {screenOptions?.tabBarInactiveTintColor}
          </Text>
          <Text testID="label-font-family">
            {screenOptions?.tabBarLabelStyle?.fontFamily as string}
          </Text>
          <Text testID="label-font-size">
            {String(screenOptions?.tabBarLabelStyle?.fontSize)}
          </Text>
        </View>
        {children}
      </View>
    );
  };

  TabsComponent.Screen = TabsScreen;

  return { Tabs: TabsComponent };
});

jest.mock('../../../hooks/useSession', () => ({
  useSession: () => ({ session: { user: { id: 'test-user' } }, user: { id: 'test-user' }, isLoading: false }),
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

jest.mock('../../../hooks/useI18n', () => ({
  useI18n: () => ({
    s: (key: string) => {
      const map: Record<string, string> = require('../../../locales/ro.json');
      return map[key] || key;
    },
    lang: 'ro' as const,
    setLang: jest.fn(),
  }),
}));

jest.mock('../../../components/Icon', () => {
  const { View } = require('react-native');
  return {
    Lucide: ({ name, size, color }: { name: string; size: number; color: string }) => (
      <View
        testID={`lucide-icon-${name}`}
        accessibilityHint={`size:${size},color:${color}`}
      />
    ),
  };
});

// eslint-disable-next-line import/first
import TabLayout from '../_layout';

describe('TabLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the Tabs navigator', () => {
    const { getByTestId } = render(<TabLayout />);
    getByTestId('tabs-navigator');
  });

  describe('tab items', () => {
    const expectedTabs = [
      { name: 'index', label: 'Hartă', icon: 'map' },
      { name: 'events', label: 'Evenimente', icon: 'calendar' },
      { name: 'leaderboard', label: 'Clasament', icon: 'trophy' },
      { name: 'favorites', label: 'Favorite', icon: 'heart' },
      { name: 'profile', label: 'Profil', icon: 'user' },
    ];

    it('renders exactly 5 tab screens', () => {
      const { getAllByTestId } = render(<TabLayout />);
      const tabScreens = getAllByTestId(/^tab-screen-/);
      expect(tabScreens).toHaveLength(5);
    });

    it.each(expectedTabs)(
      'renders "$label" tab with correct label and "$icon" icon',
      ({ name, label, icon }) => {
        const { getByTestId } = render(<TabLayout />);

        const tabLabel = getByTestId(`tab-label-${name}`);
        expect(tabLabel.props.children).toBe(label);

        getByTestId(`lucide-icon-${icon}`);
      },
    );

    it('renders tabs in the correct order: Hartă, Evenimente, Clasament, Favorite, Profil', () => {
      const { getAllByTestId } = render(<TabLayout />);
      const labels = getAllByTestId(/^tab-label-/);
      const labelTexts = labels.map(
        (label: { props: { children: string } }) => label.props.children,
      );
      expect(labelTexts).toEqual([
        'Hartă',
        'Evenimente',
        'Clasament',
        'Favorite',
        'Profil',
      ]);
    });

    it('uses icon size 22 matching TabBar.tsx design', () => {
      const { getByTestId } = render(<TabLayout />);
      const mapIcon = getByTestId('lucide-icon-map');
      expect(mapIcon.props.accessibilityHint).toContain('size:22');
    });
  });

  describe('active tab styling', () => {
    it('uses theme primary color as active tint color', () => {
      const { getByTestId } = render(<TabLayout />);
      const activeTint = getByTestId('active-tint-color');
      expect(activeTint.props.children).toBe('#14532d');
    });

    it('uses theme textFaint color as inactive tint color', () => {
      const { getByTestId } = render(<TabLayout />);
      const inactiveTint = getByTestId('inactive-tint-color');
      expect(inactiveTint.props.children).toBe('#9ca39a');
    });

    it('uses DM Sans font family for tab labels', () => {
      const { getByTestId } = render(<TabLayout />);
      const fontFamily = getByTestId('label-font-family');
      expect(fontFamily.props.children).toBe('DM Sans');
    });

    it('uses font size 10 for tab labels', () => {
      const { getByTestId } = render(<TabLayout />);
      const fontSize = getByTestId('label-font-size');
      expect(fontSize.props.children).toBe('10');
    });
  });

  describe('header visibility', () => {
    it('has headerShown set to false', () => {
      const { getByTestId } = render(<TabLayout />);
      const headerShown = getByTestId('header-shown');
      expect(headerShown.props.children).toBe('false');
    });
  });
});
