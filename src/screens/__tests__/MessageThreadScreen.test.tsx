import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({ execSync: jest.fn(), getFirstSync: jest.fn(() => null), runSync: jest.fn() }),
}));

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));

jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));

jest.mock('../../hooks/useI18n', () => ({ useI18n: () => ({ s: (k: string) => k, lang: 'en' as const }) }));
jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: require('../../theme').lightColors, isDark: false }),
}));
jest.mock('../../hooks/useSession', () => ({ useSession: () => ({ user: { id: 'me-1' } }) }));
jest.mock('../../hooks/useFocusRefresh', () => ({ useFocusRefresh: () => {} }));
jest.mock('../../lib/dialogs', () => ({ showAlert: jest.fn(), showConfirm: jest.fn() }));
jest.mock('../../contexts/I18nProvider', () => ({ getDateLocale: () => undefined }));

jest.mock('../../components/Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

const mockCanSend = jest.fn();
jest.mock('../../features/messaging', () => ({
  useDmMessagesQuery: () => ({ data: [], isLoading: false, refetch: jest.fn() }),
  useSendDmMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useCanSendInThreadQuery: () => mockCanSend(),
  markDmThreadRead: jest.fn().mockResolvedValue(undefined),
  reportDm: jest.fn(),
  unreadDmCountQueryKey: (id: string | undefined) => ['dm-unread', id],
}));

import { MessageThreadScreen } from '../MessageThreadScreen';

describe('MessageThreadScreen — staff-mediated reply gate (F023/136)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the reply input when the caller can send', () => {
    mockCanSend.mockReturnValue({ data: true, isLoading: false });
    const { queryByTestId } = render(<MessageThreadScreen threadId={1} otherName="Ada" />);
    expect(queryByTestId('dm-input')).toBeTruthy();
    expect(queryByTestId('dm-readonly')).toBeNull();
  });

  it('shows a read-only notice when the caller cannot send (user<->user thread)', () => {
    mockCanSend.mockReturnValue({ data: false, isLoading: false });
    const { queryByTestId } = render(<MessageThreadScreen threadId={1} otherName="Bob" />);
    expect(queryByTestId('dm-input')).toBeNull();
    expect(queryByTestId('dm-readonly')).toBeTruthy();
  });

  it('shows neither input nor read-only notice while the gate is still loading', () => {
    mockCanSend.mockReturnValue({ data: undefined, isLoading: true });
    const { queryByTestId } = render(<MessageThreadScreen threadId={1} otherName="Ada" />);
    expect(queryByTestId('dm-input')).toBeNull();
    expect(queryByTestId('dm-readonly')).toBeNull();
  });
});
