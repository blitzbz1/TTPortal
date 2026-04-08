jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));
jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, user: { id: 'u1' }, isLoading: false }),
}));
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    s: (key: string) => require('../../locales/en.json')[key] || key,
    lang: 'en' as const, setLang: jest.fn(),
  }),
}));
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    mode: 'light', resolved: 'light', isDark: false, setMode: jest.fn(),
  }),
}));
jest.mock('../../services/leaderboard', () => ({
  getLeaderboard: jest.fn().mockResolvedValue({ data: [] }),
}));
jest.mock('../../components/CityPickerModal', () => ({
  CityPickerModal: () => null,
}));

 
import React from 'react';
 
import { render, waitFor } from '@testing-library/react-native';
 
import { LeaderboardsScreen } from '../LeaderboardsScreen';

describe('LeaderboardsScreen — i18n', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows "All Romania" when no city is selected', async () => {
    const { getByText } = render(<LeaderboardsScreen hideTabBar />);
    await waitFor(() => {
      expect(getByText('All Romania')).toBeTruthy();
    });
  });
});
