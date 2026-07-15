import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string | undefined> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    back: mockBack,
    canDismiss: () => false,
    dismissAll: jest.fn(),
  }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

jest.mock('../../components/Icon', () => ({
  Lucide: () => null,
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    isDark: false,
  }),
}));

jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    s: (key: string, ...args: string[]) => [key, ...args].join(':'),
  }),
}));

jest.mock('../../hooks/useSession', () => ({
  useSession: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('../../hooks/queries/useProfileQuery', () => ({
  useProfileQuery: (userId?: string) => ({
    data: userId === 'opponent-1'
      ? { full_name: 'Opponent One' }
      : { full_name: 'Current User' },
  }),
}));

const mockMutateAsync = jest.fn();
jest.mock('../../features/matches', () => ({
  useLogMatchMutation: () => ({
    mutateAsync: (...args: unknown[]) => mockMutateAsync(...args),
  }),
}));

jest.mock('../../lib/haptics', () => ({
  hapticLight: jest.fn(),
}));

jest.mock('../../lib/dialogs', () => ({
  showConfirm: jest.fn(() => Promise.resolve(true)),
}));

import { QuickMatchBoardScreen } from '../QuickMatchBoardScreen';
import { QuickMatchSetupScreen } from '../QuickMatchSetupScreen';

describe('Quick Match persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ id: 41, status: 'pending' });
  });

  it('passes the QR-paired opponent to the scoreboard route', async () => {
    mockParams = { opponentId: 'opponent-1' };
    const { getByTestId } = render(<QuickMatchSetupScreen />);

    fireEvent.press(getByTestId('quick-match-start'));

    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/(protected)/quick-match/board',
      params: expect.objectContaining({ opponentId: 'opponent-1' }),
    }));
  });

  it('submits one pending result when a match finishes', async () => {
    mockParams = {
      opponentId: 'opponent-1',
      points: '11',
      bestOf: '3',
      n0: 'Current User',
      n1: 'Opponent One',
      server: '0',
    };
    const { getByTestId, findByText } = render(<QuickMatchBoardScreen />);

    for (let point = 0; point < 22; point += 1) {
      fireEvent.press(getByTestId('qm-score-0'));
    }

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(mockMutateAsync).toHaveBeenCalledWith({
      opponentId: 'opponent-1',
      sets: [{ a: 11, b: 0 }, { a: 11, b: 0 }],
      winnerId: 'user-1',
    });
    expect(await findByText('matchLoggedPending')).toBeTruthy();
  });
});
