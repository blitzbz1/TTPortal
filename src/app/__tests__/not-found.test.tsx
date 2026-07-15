import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

let mockPathname = '/';
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ replace: mockReplace }),
}));

import NotFoundRoute from '../+not-found';

describe('+not-found route recovery', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockReplace.mockReset();
    mockPathname = '/';
  });

  it('recovers deployed venue links from the real browser pathname before falling back to tabs', async () => {
    jest.replaceProperty(require('react-native').Platform, 'OS', 'web');
    Object.defineProperty(globalThis, 'window', {
      value: { location: { pathname: '/TTPortal/app/venue/46', search: '' } },
      configurable: true,
    });
    mockPathname = '/';

    render(<NotFoundRoute />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/venue/46');
    });
  });

  it('preserves query strings while recovering deployed shared links', async () => {
    jest.replaceProperty(require('react-native').Platform, 'OS', 'web');
    Object.defineProperty(globalThis, 'window', {
      value: { location: { pathname: '/TTPortal/app/venue/46', search: '?utm=share' } },
      configurable: true,
    });
    mockPathname = '/';

    render(<NotFoundRoute />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/venue/46?utm=share');
    });
  });

  it('recovers deployed event links from the real browser pathname', async () => {
    jest.replaceProperty(require('react-native').Platform, 'OS', 'web');
    Object.defineProperty(globalThis, 'window', {
      value: { location: { pathname: '/TTPortal/app/event/7', search: '' } },
      configurable: true,
    });

    render(<NotFoundRoute />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenLastCalledWith('/event/7');
    });
  });

  it('recovers deployed join links from the real browser pathname', async () => {
    jest.replaceProperty(require('react-native').Platform, 'OS', 'web');
    Object.defineProperty(globalThis, 'window', {
      value: { location: { pathname: '/TTPortal/app/join/ABC123', search: '' } },
      configurable: true,
    });

    render(<NotFoundRoute />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenLastCalledWith('/join/ABC123');
    });
  });

  it('falls back through the router pathname when no shared browser path exists', async () => {
    jest.replaceProperty(require('react-native').Platform, 'OS', 'ios');
    mockPathname = '/somewhere/else';

    render(<NotFoundRoute />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/');
    });
  });
});
