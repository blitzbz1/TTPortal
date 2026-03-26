import React from 'react';
import { render, userEvent } from '@testing-library/react-native';

// --- Mocks (must be defined before component import) ---

const mockUseSession = jest.fn();
jest.mock('../../hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (...args: unknown[]) => mockPush(...args),
  }),
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
import { HeaderProfileIcon } from '../HeaderProfileIcon';

describe('HeaderProfileIcon', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when anonymous (no session)', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        session: null,
        user: null,
        isLoading: false,
        signOut: jest.fn(),
      });
    });

    it('renders a generic user icon', () => {
      const { getByTestId } = render(<HeaderProfileIcon />);

      const icon = getByTestId('header-profile-icon');
      expect(icon).toBeTruthy();
    });

    it('navigates to /sign-in on tap', async () => {
      const { getByTestId } = render(<HeaderProfileIcon />);

      const icon = getByTestId('header-profile-icon');
      await user.press(icon);

      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/sign-in');
    });
  });

  describe('when authenticated', () => {
    const mockSignOut = jest.fn().mockResolvedValue({ error: null });

    beforeEach(() => {
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

    it('renders a circle with user initials (first letter of first + last name)', () => {
      const { getByTestId, getByText } = render(<HeaderProfileIcon />);

      const icon = getByTestId('header-profile-icon');
      expect(icon).toBeTruthy();

      const initials = getByText('IP');
      expect(initials).toBeTruthy();
    });

    it('opens popover with user name and "Deconectare" button on tap', async () => {
      const { getByTestId, getByText, queryByText } = render(
        <HeaderProfileIcon />,
      );

      // Popover should not be visible initially
      expect(queryByText('Ion Popescu')).toBeNull();
      expect(queryByText('Deconectare')).toBeNull();

      const icon = getByTestId('header-profile-icon');
      await user.press(icon);

      // Popover should now be visible
      expect(getByText('Ion Popescu')).toBeTruthy();
      expect(getByText('Deconectare')).toBeTruthy();
    });

    it('initials use Colors.green background and Colors.white text', () => {
      const { getByTestId } = render(<HeaderProfileIcon />);

      const initialsCircle = getByTestId('initials-circle');
      const flatStyle = Array.isArray(initialsCircle.props.style)
        ? Object.assign({}, ...initialsCircle.props.style)
        : initialsCircle.props.style;
      expect(flatStyle.backgroundColor).toBe('#14532d');

      const initialsText = getByTestId('initials-text');
      const textStyle = Array.isArray(initialsText.props.style)
        ? Object.assign({}, ...initialsText.props.style)
        : initialsText.props.style;
      expect(textStyle.color).toBe('#ffffff');
    });
  });
});
