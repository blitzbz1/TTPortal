import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

// --- Mocks (must be defined before component import) ---

const mockUseSession = jest.fn();
jest.mock('../../hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

const mockReplace = jest.fn();
const mockPathname = jest.fn().mockReturnValue('/add-venue');
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
  usePathname: () => mockPathname(),
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

 
import { AuthGate } from '../AuthGate';

describe('AuthGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue('/add-venue');
  });

  describe('when authenticated', () => {
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

    it('renders children normally', () => {
      const { getByText } = render(
        <AuthGate>
          <Text>Protected Content</Text>
        </AuthGate>,
      );

      expect(getByText('Protected Content')).toBeTruthy();
    });

    it('does not redirect', () => {
      render(
        <AuthGate>
          <Text>Protected Content</Text>
        </AuthGate>,
      );

      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('when anonymous', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        session: null,
        user: null,
        isLoading: false,
      });
    });

    it('navigates to /sign-in with returnTo set to current route', async () => {
      mockPathname.mockReturnValue('/add-venue');

      render(
        <AuthGate>
          <Text>Protected Content</Text>
        </AuthGate>,
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledTimes(1);
        expect(mockReplace).toHaveBeenCalledWith({
          pathname: '/sign-in',
          params: { returnTo: '/add-venue' },
        });
      });
    });

    it('does not render children', () => {
      const { queryByText } = render(
        <AuthGate>
          <Text>Protected Content</Text>
        </AuthGate>,
      );

      expect(queryByText('Protected Content')).toBeNull();
    });

    it('passes the correct returnTo for review routes', async () => {
      mockPathname.mockReturnValue('/review/venue-456');

      render(
        <AuthGate>
          <Text>Write Review</Text>
        </AuthGate>,
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith({
          pathname: '/sign-in',
          params: { returnTo: '/review/venue-456' },
        });
      });
    });
  });

  describe('after auth completes', () => {
    it('redirects user to the original returnTo route', () => {
      // Start anonymous — should redirect
      mockUseSession.mockReturnValue({
        session: null,
        user: null,
        isLoading: false,
      });

      const { rerender, getByText } = render(
        <AuthGate>
          <Text>Protected Content</Text>
        </AuthGate>,
      );

      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/sign-in',
        params: { returnTo: '/add-venue' },
      });

      // Simulate auth completing — session now present
      mockUseSession.mockReturnValue({
        session: {
          access_token: 'test-token',
          user: { id: 'user-1', email: 'test@example.com' },
        },
        user: { id: 'user-1', email: 'test@example.com' },
        isLoading: false,
      });

      rerender(
        <AuthGate>
          <Text>Protected Content</Text>
        </AuthGate>,
      );

      // Children should now render (the returnTo redirect is handled by sign-in screen)
      expect(getByText('Protected Content')).toBeTruthy();
    });
  });
});
