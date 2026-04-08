// --- Mocks (must be defined before component import) ---

const mockS = jest.fn((key: string) => {
  const map: Record<string, string> = {
    tabMap: 'Map', tabEvents: 'Events', tabLeaderboard: 'Leaderboard',
    tabFavorites: 'Favorites', tabProfile: 'Profile',
  };
  return map[key] || key;
});

jest.mock('../../../hooks/useI18n', () => ({
  useI18n: () => ({ s: mockS, lang: 'en' as const, setLang: jest.fn() }),
}));
jest.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../../theme').lightColors,
    mode: 'light', resolved: 'light', isDark: false, setMode: jest.fn(),
  }),
}));
jest.mock('../../../hooks/useSession', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, user: { id: 'u1' }, isLoading: false }),
}));

// Mock expo-router Tabs to capture screen options
const mockTabsScreen = jest.fn((_props: any) => null);
jest.mock('expo-router', () => {
   
  const TabsComponent: any = ({ children }: any) => children;
  // eslint-disable-next-line react/display-name
  TabsComponent.Screen = (props: any) => { mockTabsScreen(props); return null; };
  return { Tabs: TabsComponent };
});

 
import React from 'react';
 
import { render } from '@testing-library/react-native';
 
import TabLayout from '../_layout';

describe('TabLayout i18n', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses i18n keys for tab labels', () => {
    render(<TabLayout />);
    // s() should have been called with tab label keys
    expect(mockS).toHaveBeenCalledWith('tabMap');
    expect(mockS).toHaveBeenCalledWith('tabEvents');
    expect(mockS).toHaveBeenCalledWith('tabFavorites');
    expect(mockS).toHaveBeenCalledWith('tabProfile');
  });
});
