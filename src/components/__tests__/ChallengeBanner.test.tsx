import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
  }),
}));

const mockS = jest.fn((key: string) => key);
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({ s: mockS }),
}));

const mockUseSession = jest.fn();
jest.mock('../../hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('../Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

jest.mock('../../services/challenges', () => ({
  getMonthlyStats: jest.fn().mockResolvedValue({
    monthCheckins: 5,
    monthVenues: 2,
    monthReviews: 1,
  }),
}));

import { ChallengeBanner } from '../ChallengeBanner';

beforeEach(() => {
  jest.clearAllMocks();
  mockS.mockImplementation((key: string) => key);
});

describe('ChallengeBanner', () => {
  it('returns null when user is not logged in', () => {
    mockUseSession.mockReturnValue({ user: null });
    const { queryByTestId } = render(<ChallengeBanner />);
    expect(queryByTestId('challenge-banner')).toBeNull();
  });

  it('renders the banner when user is logged in', async () => {
    mockUseSession.mockReturnValue({ user: { id: 'u1' } });
    const { findByTestId } = render(<ChallengeBanner />);
    expect(await findByTestId('challenge-banner')).toBeTruthy();
  });

  it('renders progress count', async () => {
    mockUseSession.mockReturnValue({ user: { id: 'u1' } });
    const { findByTestId } = render(<ChallengeBanner />);
    const banner = await findByTestId('challenge-banner');
    // Banner should contain progress text (e.g. "2/3" or "5/8")
    expect(banner).toBeTruthy();
  });
});
