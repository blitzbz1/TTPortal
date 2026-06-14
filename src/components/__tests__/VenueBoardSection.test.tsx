import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { VenueBoardSection } from '../VenueBoardSection';

const mockUseBoard = jest.fn();
const mockPost = jest.fn().mockResolvedValue(undefined);
const mockHelpful = jest.fn();
const mockDelete = jest.fn().mockResolvedValue(undefined);
jest.mock('../../features/venueBoard', () => ({
  useVenueBoardQuery: (...a: any[]) => mockUseBoard(...a),
  usePostVenueMessageMutation: () => ({ mutateAsync: mockPost, isPending: false }),
  useTogglePostHelpfulMutation: () => ({ mutate: mockHelpful, isPending: false }),
  useDeleteVenuePostMutation: () => ({ mutateAsync: mockDelete, isPending: false }),
}));

jest.mock('../../services/moderation', () => ({ reportContent: jest.fn().mockResolvedValue({ error: null }) }));
jest.mock('../ReportReasonModal', () => ({ ReportReasonModal: () => null }));
jest.mock('../../lib/dialogs', () => ({ showAlert: jest.fn(), showConfirm: jest.fn() }));
jest.mock('../../contexts/I18nProvider', () => ({ getDateLocale: () => 'en-US' }));
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: {
    bg: '#fff', bgAlt: '#f7f7f7', border: '#ccc', text: '#111', textMuted: '#444', textFaint: '#999',
    textOnPrimary: '#fff', primary: '#14532d', primaryMid: '#166534', primaryLight: '#22c55e',
  } }),
}));
jest.mock('../../hooks/useI18n', () => ({ useI18n: () => ({ s: (key: string) => key, lang: 'en' }) }));
jest.mock('../Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));
jest.mock('../Card', () => ({
  Card: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

const RECENT = '2026-06-10T10:00:00Z';
const post = (over: any = {}) => ({
  id: 1, user_id: 'u2', body: 'Are the tables free on Sundays?', helpful_count: 2,
  created_at: RECENT, author_name: 'Dana', author_avatar: null, viewer_voted: false, replies: [], ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseBoard.mockReturnValue({ data: [], isLoading: false });
});

describe('VenueBoardSection (F016)', () => {
  it('shows the empty state when there are no posts', () => {
    const { getByText } = render(<VenueBoardSection venueId={1} currentUserId="me" />);
    expect(getByText('venueBoardEmpty')).toBeTruthy();
  });

  it('renders a question and its reply', () => {
    mockUseBoard.mockReturnValue({
      data: [post({ replies: [{ id: 9, user_id: 'u3', body: 'Yes, usually.', created_at: RECENT, author_name: 'Radu', author_avatar: null }] })],
      isLoading: false,
    });
    const { getByText } = render(<VenueBoardSection venueId={1} currentUserId="me" />);
    expect(getByText('Are the tables free on Sundays?')).toBeTruthy();
    expect(getByText('Yes, usually.')).toBeTruthy();
  });

  it('posts a new question', async () => {
    const { getByTestId } = render(<VenueBoardSection venueId={1} currentUserId="me" />);
    fireEvent.changeText(getByTestId('board-ask-input'), 'New question?');
    fireEvent.press(getByTestId('board-ask-send'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith({ body: 'New question?' }));
  });

  it('toggles a helpful vote', () => {
    mockUseBoard.mockReturnValue({ data: [post()], isLoading: false });
    const { getByTestId } = render(<VenueBoardSection venueId={1} currentUserId="me" />);
    fireEvent.press(getByTestId('board-helpful-1'));
    expect(mockHelpful).toHaveBeenCalledWith(1);
  });

  it('replies to a post with the parent id', async () => {
    mockUseBoard.mockReturnValue({ data: [post()], isLoading: false });
    const { getByTestId } = render(<VenueBoardSection venueId={1} currentUserId="me" />);
    fireEvent.press(getByTestId('board-reply-btn-1'));
    fireEvent.changeText(getByTestId('board-reply-input-1'), 'My answer');
    fireEvent.press(getByTestId('board-reply-send-1'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith({ body: 'My answer', parentId: 1 }));
  });

  it('collapses posts older than 60 days behind a toggle', () => {
    mockUseBoard.mockReturnValue({
      data: [post({ id: 5, created_at: '2020-01-01T00:00:00Z', body: 'Ancient question' })],
      isLoading: false,
    });
    const { getByTestId, queryByText, getByText } = render(<VenueBoardSection venueId={1} currentUserId="me" />);
    expect(queryByText('Ancient question')).toBeNull();
    fireEvent.press(getByTestId('board-show-older'));
    expect(getByText('Ancient question')).toBeTruthy();
  });

  it('hides the ask box for signed-out visitors', () => {
    const { queryByTestId } = render(<VenueBoardSection venueId={1} currentUserId={undefined} />);
    expect(queryByTestId('board-ask-input')).toBeNull();
  });
});
