import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { FeedbackHeaderButton } from '../FeedbackHeaderButton';

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

const mockModal = jest.fn();
jest.mock('../UserFeedbackModal', () => ({
  UserFeedbackModal: (props: any) => {
    mockModal(props);
    return null;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('FeedbackHeaderButton', () => {
  it('renders nothing when there is no session', () => {
    mockSession.mockReturnValue({ session: null });
    const { queryByTestId } = render(<FeedbackHeaderButton color="#fff" />);
    expect(queryByTestId('header-feedback-button')).toBeNull();
    expect(mockModal).not.toHaveBeenCalled();
  });

  it('renders the button when authenticated, modal stays unmounted until opened', () => {
    mockSession.mockReturnValue({ session: { user: { id: 'u-1' } } });
    const { getByTestId } = render(<FeedbackHeaderButton color="#fff" />);
    expect(getByTestId('header-feedback-button')).toBeTruthy();
    expect(getByTestId('icon-clipboard-pen-line')).toBeTruthy();
    expect(mockModal).not.toHaveBeenCalled();
  });

  it('mounts the modal (visible=true) when pressed', () => {
    mockSession.mockReturnValue({ session: { user: { id: 'u-1' } } });
    const { getByTestId } = render(<FeedbackHeaderButton color="#fff" />);
    fireEvent.press(getByTestId('header-feedback-button'));
    expect(mockModal).toHaveBeenCalledWith(
      expect.objectContaining({ visible: true }),
    );
  });
});
