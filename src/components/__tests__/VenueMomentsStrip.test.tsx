import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { VenueMomentsStrip } from '../VenueMomentsStrip';

const mockUseMoments = jest.fn();
const mockDelete = jest.fn().mockResolvedValue(undefined);
jest.mock('../../features/checkinMoments', () => ({
  useVenueMomentsQuery: (...a: any[]) => mockUseMoments(...a),
  useDeleteMomentMutation: () => ({ mutateAsync: mockDelete, isPending: false }),
}));

const mockReport = jest.fn().mockResolvedValue({ error: null });
jest.mock('../../services/moderation', () => ({ reportContent: (...a: any[]) => mockReport(...a) }));
jest.mock('../ReportReasonModal', () => ({ ReportReasonModal: () => null }));
const mockShowConfirm = jest.fn();
jest.mock('../../lib/dialogs', () => ({
  showAlert: jest.fn(),
  showConfirm: (...a: any[]) => mockShowConfirm(...a),
}));
jest.mock('../../contexts/I18nProvider', () => ({ getDateLocale: () => 'en-US' }));
jest.mock('../../lib/imageTransforms', () => ({ venueImageUrl: (u: string) => u }));
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

const moment = (over: any = {}) => ({
  id: 1, user_id: 'u2', venue_id: 1, photo_url: 'https://cdn/m1.jpg', caption: 'Great session!',
  created_at: '2026-06-10T10:00:00Z', author_name: 'Dana', author_avatar: null, author_username: 'dana', ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMoments.mockReturnValue({ data: [], isLoading: false });
});

describe('VenueMomentsStrip (F042)', () => {
  it('renders nothing when there are no moments', () => {
    const { queryByTestId } = render(<VenueMomentsStrip venueId={1} currentUserId="me" />);
    expect(queryByTestId('venue-moments-strip')).toBeNull();
  });

  it('renders moment cards with author + caption', () => {
    mockUseMoments.mockReturnValue({ data: [moment()], isLoading: false });
    const { getByTestId, getByText } = render(<VenueMomentsStrip venueId={1} currentUserId="me" />);
    expect(getByTestId('venue-moments-strip')).toBeTruthy();
    expect(getByTestId('moment-card-1')).toBeTruthy();
    expect(getByText('Dana')).toBeTruthy();
    expect(getByText('Great session!')).toBeTruthy();
  });

  it('long-pressing the author\'s own moment confirms a soft-delete', async () => {
    mockShowConfirm.mockResolvedValue(true);
    mockUseMoments.mockReturnValue({ data: [moment({ user_id: 'me' })], isLoading: false });
    const { getByTestId } = render(<VenueMomentsStrip venueId={1} currentUserId="me" />);
    fireEvent(getByTestId('moment-card-1'), 'longPress');
    await waitFor(() => expect(mockShowConfirm).toHaveBeenCalled());
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1));
  });

  it('long-pressing another user\'s moment opens the report flow (no delete)', async () => {
    mockUseMoments.mockReturnValue({ data: [moment({ user_id: 'u2' })], isLoading: false });
    const { getByTestId } = render(<VenueMomentsStrip venueId={1} currentUserId="me" />);
    fireEvent(getByTestId('moment-card-1'), 'longPress');
    await waitFor(() => expect(mockShowConfirm).not.toHaveBeenCalled());
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
