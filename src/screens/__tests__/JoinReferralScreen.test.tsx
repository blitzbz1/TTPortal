import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

const mockS = jest.fn((key: string) => key);
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({ s: mockS, lang: 'en' as const }),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: require('../../theme').lightColors, isDark: false }),
}));

const mockUseSession = jest.fn();
jest.mock('../../hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

const mockShowAlert = jest.fn();
jest.mock('../../lib/dialogs', () => ({ showAlert: (...a: any[]) => mockShowAlert(...a) }));

const mockClaimReferral = jest.fn();
jest.mock('../../services/referrals', () => ({
  claimReferral: (...a: any[]) => mockClaimReferral(...a),
}));

const mockJoinClubByCode = jest.fn();
jest.mock('../../services/clubs', () => ({
  joinClubByCode: (...a: any[]) => mockJoinClubByCode(...a),
}));

const mockStash = jest.fn();
const mockClear = jest.fn();
jest.mock('../../lib/referralStash', () => ({
  stashPendingReferralCode: (...a: any[]) => mockStash(...a),
  readPendingReferralCode: () => null,
  clearPendingReferralCode: (...a: any[]) => mockClear(...a),
}));

jest.mock('../../lib/friendsCache', () => ({ invalidateFriendsCache: jest.fn() }));

import { JoinReferralScreen } from '../JoinReferralScreen';

describe('JoinReferralScreen (F041 deep-link claim)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('with a session: claims the referral and routes to friends', async () => {
    mockUseSession.mockReturnValue({ user: { id: 'me-1' }, isLoading: false });
    mockClaimReferral.mockResolvedValue({ data: 'referrer-9', error: null });

    render(<JoinReferralScreen code="ABC123" />);

    await waitFor(() => {
      expect(mockClaimReferral).toHaveBeenCalledWith('ABC123');
      expect(mockReplace).toHaveBeenCalledWith('/(protected)/friends');
    });
    expect(mockJoinClubByCode).not.toHaveBeenCalled();
  });

  it('without a session: stashes the code and routes to sign-in with returnTo', async () => {
    mockUseSession.mockReturnValue({ user: null, isLoading: false });

    render(<JoinReferralScreen code="ABC123" />);

    await waitFor(() => {
      expect(mockStash).toHaveBeenCalledWith('ABC123');
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/sign-in',
        params: { returnTo: '/join/ABC123' },
      });
    });
    expect(mockClaimReferral).not.toHaveBeenCalled();
  });

  it('falls back to a club join when the code is not a referral code', async () => {
    mockUseSession.mockReturnValue({ user: { id: 'me-1' }, isLoading: false });
    mockClaimReferral.mockResolvedValue({ data: null, error: { message: 'referrer_not_found' } });
    mockJoinClubByCode.mockResolvedValue({ data: 42, error: null });

    render(<JoinReferralScreen code="CLB999" />);

    await waitFor(() => {
      expect(mockJoinClubByCode).toHaveBeenCalledWith('CLB999');
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/(protected)/clubs/[id]',
        params: { id: '42' },
      });
    });
  });

  it('waits while the session is still loading', async () => {
    mockUseSession.mockReturnValue({ user: null, isLoading: true });

    render(<JoinReferralScreen code="ABC123" />);

    // No routing decisions until the session resolves.
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockClaimReferral).not.toHaveBeenCalled();
    expect(mockStash).not.toHaveBeenCalled();
  });
});
