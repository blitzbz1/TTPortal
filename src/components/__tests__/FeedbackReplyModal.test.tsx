import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

import { FeedbackReplyModal } from '../FeedbackReplyModal';

const mockGetReplies = jest.fn();
const mockReply = jest.fn();

jest.mock('../../services/admin', () => ({
  getFeedbackReplies: (...args: any[]) => mockGetReplies(...args),
  replyToFeedback: (...args: any[]) => mockReply(...args),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: require('../../theme').lightColors, isDark: false }),
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

const feedback = {
  id: 'f-1',
  message: 'Map does not center',
  category: 'bug',
  created_at: '2026-04-20T10:00:00Z',
  profiles: { full_name: 'Ion Popescu', email: 'ion@x.com' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.mockReturnValue({ user: { id: 'admin-1' } });
  mockGetReplies.mockResolvedValue({ data: [] });
  mockReply.mockResolvedValue({ data: { id: 'r-1', reply_text: 'Fixed', created_at: '2026-04-21T10:00:00Z', admin_id: 'admin-1' }, error: null });
});

describe('FeedbackReplyModal', () => {
  it('renders nothing when feedback is null', () => {
    const { queryByText } = render(<FeedbackReplyModal feedback={null} onClose={jest.fn()} />);
    expect(queryByText('feedbackReplyTitle')).toBeNull();
  });

  it('shows the original feedback and loads existing replies', async () => {
    mockGetReplies.mockResolvedValue({
      data: [
        { id: 'r-existing', reply_text: 'Previous reply', created_at: '2026-04-19T10:00:00Z', admin_id: 'admin-0', profiles: { full_name: 'Old Admin' } },
      ],
    });

    const { getByText, getByTestId } = render(
      <FeedbackReplyModal feedback={feedback} onClose={jest.fn()} />,
    );
    await act(async () => {});

    expect(getByText('Ion Popescu')).toBeTruthy();
    expect(getByText('Map does not center')).toBeTruthy();
    expect(getByTestId('reply-r-existing')).toBeTruthy();
    expect(mockGetReplies).toHaveBeenCalledWith('f-1');
  });

  it('send button disabled when input is empty', async () => {
    const { getByTestId } = render(
      <FeedbackReplyModal feedback={feedback} onClose={jest.fn()} />,
    );
    await act(async () => {});
    fireEvent.press(getByTestId('feedback-reply-send'));
    expect(mockReply).not.toHaveBeenCalled();
  });

  it('sends a reply, appends it to the list, and clears input', async () => {
    const { getByTestId, findByTestId } = render(
      <FeedbackReplyModal feedback={feedback} onClose={jest.fn()} />,
    );
    await act(async () => {});

    fireEvent.changeText(getByTestId('feedback-reply-input'), 'Fixed in next release');
    await act(async () => {
      fireEvent.press(getByTestId('feedback-reply-send'));
    });

    expect(mockReply).toHaveBeenCalledWith('f-1', 'admin-1', 'Fixed in next release');
    await findByTestId('reply-r-1');
    expect(getByTestId('feedback-reply-input').props.value).toBe('');
  });

  it('closes via the X button', async () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <FeedbackReplyModal feedback={feedback} onClose={onClose} />,
    );
    await act(async () => {});
    fireEvent.press(getByTestId('feedback-reply-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('resets state when switching feedback items', async () => {
    const { getByText, rerender, queryByText } = render(
      <FeedbackReplyModal feedback={feedback} onClose={jest.fn()} />,
    );
    await act(async () => {});
    expect(getByText('Map does not center')).toBeTruthy();

    const other = { ...feedback, id: 'f-2', message: 'Second report', profiles: { full_name: 'Jane', email: null } };
    mockGetReplies.mockResolvedValue({ data: [] });

    await act(async () => {
      rerender(<FeedbackReplyModal feedback={other} onClose={jest.fn()} />);
    });

    await waitFor(() => expect(getByText('Second report')).toBeTruthy());
    expect(queryByText('Map does not center')).toBeNull();
    expect(mockGetReplies).toHaveBeenLastCalledWith('f-2');
  });
});
