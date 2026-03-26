import React from 'react';
import { render } from '@testing-library/react-native';

// --- Mocks (must be defined before component import) ---

const mockUseSession = jest.fn();
jest.mock('../../../hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

const mockReplace = jest.fn();
const mockPathname = jest.fn();

jest.mock('expo-router', () => {
  const { View } = require('react-native');
  const StackComponent = ({ children }: { children?: React.ReactNode }) => (
    <View testID="stack-navigator">{children}</View>
  );
  const MockScreen = () => null;
  const MockProtected = ({
    children,
    guard,
  }: {
    children?: React.ReactNode;
    guard: boolean;
  }) => (guard ? <View testID="protected-content">{children}</View> : null);
  StackComponent.Screen = MockScreen;
  StackComponent.Protected = MockProtected;
  return {
    Stack: StackComponent,
    useRouter: () => ({
      replace: (...args: unknown[]) => mockReplace(...args),
    }),
    usePathname: () => mockPathname(),
  };
});

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    track: jest.fn(),
  },
}));

// eslint-disable-next-line import/first
import ProtectedLayout from '../_layout';
// eslint-disable-next-line import/first
import { logger } from '../../../lib/logger';

describe('ProtectedLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue('/add-venue');
  });

  describe('when session is null (unauthenticated)', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        session: null,
        user: null,
        isLoading: false,
      });
    });

    it('redirects to /sign-in with returnTo param', () => {
      render(<ProtectedLayout />);

      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/sign-in',
        params: { returnTo: '/add-venue' },
      });
    });

    it('does not render the Stack navigator', () => {
      const { queryByTestId } = render(<ProtectedLayout />);

      expect(queryByTestId('stack-navigator')).toBeNull();
      expect(queryByTestId('protected-content')).toBeNull();
    });

    it('passes the correct returnTo for review routes', () => {
      mockPathname.mockReturnValue('/review/venue-123');

      render(<ProtectedLayout />);

      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/sign-in',
        params: { returnTo: '/review/venue-123' },
      });
    });

    it('logs the redirect with the target pathname', () => {
      render(<ProtectedLayout />);

      expect(logger.info).toHaveBeenCalledWith(
        'Redirecting unauthenticated user to sign-in',
        { returnTo: '/add-venue' },
      );
    });
  });

  describe('when session exists (authenticated)', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        session: {
          access_token: 'test-token',
          user: { id: 'user-1', email: 'test@example.com' },
        },
        user: { id: 'user-1', email: 'test@example.com' },
        isLoading: false,
      });
    });

    it('does not redirect to sign-in', () => {
      render(<ProtectedLayout />);

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('renders the Stack navigator', () => {
      const { getByTestId } = render(<ProtectedLayout />);

      getByTestId('stack-navigator');
    });

    it('renders protected content with guard enabled', () => {
      const { getByTestId } = render(<ProtectedLayout />);

      getByTestId('protected-content');
    });

    it('does not log a redirect', () => {
      render(<ProtectedLayout />);

      expect(logger.info).not.toHaveBeenCalled();
    });
  });
});
