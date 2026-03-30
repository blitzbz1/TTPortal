import React from 'react';
import { fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';

// --- Mocks (must be defined before component import) ---

const mockSignUp = jest.fn();
const mockUseSession = jest.fn();

jest.mock('../../hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    s: (key: string) => {
      const ro: Record<string, string> = require('../../locales/ro.json');
      return ro[key] || key;
    },
    lang: 'ro' as const,
    setLang: jest.fn(),
  }),
}));

const mockReplace = jest.fn();
const mockSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: (...a: unknown[]) => mockReplace(...a) }),
  useLocalSearchParams: () => mockSearchParams(),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    mode: 'light',
    resolved: 'light',
    isDark: false,
    setMode: jest.fn(),
  }),
}));

// eslint-disable-next-line import/first
import SignInScreen from '../sign-in';

/** Fills the signup form with valid data and presses submit. */
async function fillAndSubmit(
  getByTestId: ReturnType<typeof render>['getByTestId'],
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.type(getByTestId('input-name'), 'John Doe');
  await user.type(getByTestId('input-email'), 'john@example.com');
  await user.type(getByTestId('input-password'), 'password123');
  await user.press(getByTestId('submit-button'));
}

describe('SignInScreen — registration flow (T013)', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSignUp.mockResolvedValue({ error: null });
    mockUseSession.mockReturnValue({
      session: null,
      user: null,
      isLoading: false,
      signUp: (...a: unknown[]) => mockSignUp(...a),
      signIn: jest.fn(),
      signInWithGoogle: jest.fn(),
      signInWithApple: jest.fn(),
      signOut: jest.fn(),
      resetPassword: jest.fn(),
    });
    mockSearchParams.mockReturnValue({});
    mockReplace.mockReset();
  });

  it('successful signUp navigates to /(tabs)/ by default', async () => {
    const { getByTestId } = render(<SignInScreen />);
    fireEvent.press(getByTestId('tab-signup'));

    await fillAndSubmit(getByTestId, user);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  it('successful signUp navigates to returnTo param when present', async () => {
    mockSearchParams.mockReturnValue({ returnTo: '/add-venue' });

    const { getByTestId } = render(<SignInScreen />);
    fireEvent.press(getByTestId('tab-signup'));

    await fillAndSubmit(getByTestId, user);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/add-venue');
    });
  });

  it('duplicate email error from server shows account exists message with OAuth suggestion', async () => {
    mockSignUp.mockResolvedValue({
      error: {
        message: 'User already registered',
        code: 'user_already_exists',
        status: 422,
        name: 'AuthApiError',
      },
    });

    const { getByTestId, getByText } = render(<SignInScreen />);
    fireEvent.press(getByTestId('tab-signup'));

    await fillAndSubmit(getByTestId, user);

    await waitFor(() => {
      expect(getByText('Acest email este deja folosit. Încearcă conectarea cu Google sau Apple.')).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('network error shows "Eroare de conexiune. Încearcă din nou."', async () => {
    mockSignUp.mockResolvedValue({
      error: {
        message: 'Failed to fetch',
        name: 'AuthRetryableFetchError',
        status: 0,
      },
    });

    const { getByTestId, getByText } = render(<SignInScreen />);
    fireEvent.press(getByTestId('tab-signup'));

    await fillAndSubmit(getByTestId, user);

    await waitFor(() => {
      expect(
        getByText('Eroare de conexiune. Încearcă din nou.'),
      ).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('loading state disables submit button during signUp call', async () => {
    let resolveSignUp!: (value: { error: null }) => void;
    mockSignUp.mockReturnValue(
      new Promise<{ error: null }>((resolve) => {
        resolveSignUp = resolve;
      }),
    );

    const { getByTestId } = render(<SignInScreen />);
    fireEvent.press(getByTestId('tab-signup'));

    await user.type(getByTestId('input-name'), 'John Doe');
    await user.type(getByTestId('input-email'), 'john@example.com');
    await user.type(getByTestId('input-password'), 'password123');

    // Press submit — signUp is now pending
    await user.press(getByTestId('submit-button'));

    // Button should be disabled while loading
    await waitFor(() => {
      expect(
        getByTestId('submit-button').props.accessibilityState?.disabled,
      ).toBe(true);
    });

    // Resolve the signUp promise
    await waitFor(async () => {
      resolveSignUp({ error: null });
    });

    // Button should be re-enabled
    await waitFor(() => {
      expect(
        getByTestId('submit-button').props.accessibilityState?.disabled ??
          false,
      ).toBe(false);
    });
  });
});
