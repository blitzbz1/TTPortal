import React from 'react';
import { render, userEvent, waitFor } from '@testing-library/react-native';

// --- Mocks (must be defined before component import) ---

const mockUseSession = jest.fn();
jest.mock('../../hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    s: (key: string) => {
      const strings: Record<string, string> = {
        logout: 'Deconectare',
      };
      return strings[key] || key;
    },
  }),
}));

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    track: jest.fn(),
  },
}));

// eslint-disable-next-line import/first
import { ProfilePopover } from '../ProfilePopover';

describe('ProfilePopover', () => {
  const user = userEvent.setup();
  const mockOnClose = jest.fn();
  const mockSignOut = jest.fn().mockResolvedValue({ error: null });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({
      session: {
        access_token: 'test-token',
        user: {
          id: 'user-1',
          email: 'ion@example.com',
          user_metadata: { full_name: 'Ion Popescu' },
        },
      },
      user: {
        id: 'user-1',
        email: 'ion@example.com',
        user_metadata: { full_name: 'Ion Popescu' },
      },
      isLoading: false,
      signOut: mockSignOut,
    });
  });

  it('shows user full name', () => {
    const { getByText } = render(
      <ProfilePopover visible onClose={mockOnClose} />,
    );

    expect(getByText('Ion Popescu')).toBeTruthy();
  });

  it('shows user email (truncated if >25 chars)', () => {
    mockUseSession.mockReturnValue({
      session: {
        access_token: 'test-token',
        user: {
          id: 'user-2',
          email: 'very-long-email-address-for-testing@example.com',
          user_metadata: { full_name: 'Long Email User' },
        },
      },
      user: {
        id: 'user-2',
        email: 'very-long-email-address-for-testing@example.com',
        user_metadata: { full_name: 'Long Email User' },
      },
      isLoading: false,
      signOut: mockSignOut,
    });

    const { getByTestId } = render(
      <ProfilePopover visible onClose={mockOnClose} />,
    );

    const emailElement = getByTestId('popover-email');
    const emailText = emailElement.props.children as string;
    expect(emailText.length).toBeLessThanOrEqual(28); // 25 chars + '...'
    expect(emailText).toBe('very-long-email-address-f...');
  });

  it('shows short email without truncation', () => {
    const { getByText } = render(
      <ProfilePopover visible onClose={mockOnClose} />,
    );

    expect(getByText('ion@example.com')).toBeTruthy();
  });

  it('calls signOut when "Deconectare" button is tapped', async () => {
    const { getByText } = render(
      <ProfilePopover visible onClose={mockOnClose} />,
    );

    const logoutButton = getByText('Deconectare');
    await user.press(logoutButton);

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('closes popover after signOut completes', async () => {
    const { getByText } = render(
      <ProfilePopover visible onClose={mockOnClose} />,
    );

    const logoutButton = getByText('Deconectare');
    await user.press(logoutButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it('closes popover when tapping outside (overlay)', async () => {
    const { getByTestId } = render(
      <ProfilePopover visible onClose={mockOnClose} />,
    );

    const overlay = getByTestId('popover-overlay');
    await user.press(overlay);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not render when visible is false', () => {
    const { queryByText } = render(
      <ProfilePopover visible={false} onClose={mockOnClose} />,
    );

    expect(queryByText('Ion Popescu')).toBeNull();
    expect(queryByText('Deconectare')).toBeNull();
  });
});
