import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

import { UserFeedbackModal } from '../UserFeedbackModal';

const mockSubmit = jest.fn();
jest.mock('../../services/userFeedback', () => ({
  submitUserFeedback: (...args: any[]) => mockSubmit(...args),
}));

const mockUseTheme = jest.fn();
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => mockUseTheme(),
}));

const mockSession = jest.fn();
jest.mock('../../hooks/useSession', () => ({
  useSession: () => mockSession(),
}));

jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({ s: (key: string) => key }),
}));

jest.mock('../Icon', () => ({
  Lucide: ({ name }: { name: string }) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} />;
  },
}));

jest.mock('expo-router', () => ({
  usePathname: () => '/events',
}));

const mockColors = {
  bg: '#fff',
  bgAlt: '#fff',
  border: '#ccc',
  text: '#000',
  textMuted: '#666',
  textFaint: '#999',
  textOnPrimary: '#fff',
  primary: '#0a0',
  primaryLight: '#0c0',
  primaryPale: '#efe',
  primaryDim: '#dfd',
  red: '#f00',
  overlayHeavy: '#000a',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTheme.mockReturnValue({ colors: mockColors });
  mockSession.mockReturnValue({
    session: { user: { id: 'u-1', email: 'u@x.com' } },
    user: { id: 'u-1', email: 'u@x.com' },
  });
  mockSubmit.mockResolvedValue({ data: { id: 'ok' }, error: null });
});

describe('UserFeedbackModal', () => {
  it('renders nothing when not visible', () => {
    const { queryByText } = render(
      <UserFeedbackModal visible={false} onClose={jest.fn()} />,
    );
    expect(queryByText('feedbackTitle')).toBeNull();
  });

  it('defaults to general category and hides the feature title input', () => {
    const { getByTestId, queryByTestId } = render(
      <UserFeedbackModal visible onClose={jest.fn()} />,
    );
    expect(getByTestId('feedback-category-general')).toBeTruthy();
    expect(queryByTestId('feedback-feature-title')).toBeNull();
  });

  it('shows the feature title input after selecting feature category', () => {
    const { getByTestId } = render(
      <UserFeedbackModal visible onClose={jest.fn()} />,
    );
    fireEvent.press(getByTestId('feedback-category-feature'));
    expect(getByTestId('feedback-feature-title')).toBeTruthy();
  });

  it('shows validation error when submitting empty message', () => {
    const { getByTestId, queryByText } = render(
      <UserFeedbackModal visible onClose={jest.fn()} />,
    );
    // Submit button is disabled when message is empty, but the handler also
    // short-circuits; we instead type whitespace then try to submit.
    fireEvent.changeText(getByTestId('feedback-message'), '   ');
    // Button remains disabled — verify no submit fired
    fireEvent.press(getByTestId('feedback-submit'));
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(queryByText('feedbackSuccessTitle')).toBeNull();
  });

  it('requires a feature title when category is feature', async () => {
    const { getByTestId, findByText } = render(
      <UserFeedbackModal visible onClose={jest.fn()} />,
    );
    fireEvent.press(getByTestId('feedback-category-feature'));
    fireEvent.changeText(getByTestId('feedback-message'), 'Cool idea');
    // featureTitle empty → canSubmit false → button disabled; direct press shouldn't submit
    fireEvent.press(getByTestId('feedback-submit'));
    expect(mockSubmit).not.toHaveBeenCalled();
    // Now add a title and submit works
    fireEvent.changeText(getByTestId('feedback-feature-title'), 'Dark mode');
    await act(async () => {
      fireEvent.press(getByTestId('feedback-submit'));
    });
    await findByText('feedbackSuccessTitle');
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'feature',
        featureTitle: 'Dark mode',
        message: 'Cool idea',
        page: '/events',
        userId: 'u-1',
        userEmail: 'u@x.com',
      }),
    );
  });

  it('submits bug feedback and shows success state', async () => {
    const { getByTestId, findByText } = render(
      <UserFeedbackModal visible onClose={jest.fn()} />,
    );
    fireEvent.press(getByTestId('feedback-category-bug'));
    fireEvent.changeText(getByTestId('feedback-message'), 'crash on open');
    await act(async () => {
      fireEvent.press(getByTestId('feedback-submit'));
    });
    await findByText('feedbackSuccessTitle');
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'bug',
        message: 'crash on open',
        featureTitle: undefined,
      }),
    );
  });

  it('shows generic error when submit fails', async () => {
    mockSubmit.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const { getByTestId, findByText, queryByText } = render(
      <UserFeedbackModal visible onClose={jest.fn()} />,
    );
    fireEvent.changeText(getByTestId('feedback-message'), 'hi');
    await act(async () => {
      fireEvent.press(getByTestId('feedback-submit'));
    });
    await findByText('feedbackErrorGeneric');
    expect(queryByText('feedbackSuccessTitle')).toBeNull();
  });

  it('closes via the Done button after success', async () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <UserFeedbackModal visible onClose={onClose} />,
    );
    fireEvent.changeText(getByTestId('feedback-message'), 'hi');
    await act(async () => {
      fireEvent.press(getByTestId('feedback-submit'));
    });
    await waitFor(() => expect(getByTestId('feedback-done')).toBeTruthy());
    fireEvent.press(getByTestId('feedback-done'));
    expect(onClose).toHaveBeenCalled();
  });

  it('close button dismisses without submitting', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <UserFeedbackModal visible onClose={onClose} />,
    );
    fireEvent.press(getByTestId('feedback-close'));
    expect(onClose).toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
