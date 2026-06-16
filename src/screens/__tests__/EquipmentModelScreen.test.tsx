import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';

import { EquipmentModelScreen } from '../EquipmentModelScreen';
import {
  useCallerOwnsModelQuery,
  useEquipmentModelReviewsQuery,
  useEquipmentModelSummaryQuery,
  usePostEquipmentReviewMutation,
} from '../../hooks/queries/useEquipmentReviewsQuery';
import { reportContent } from '../../services/moderation';

jest.mock('../../hooks/queries/useEquipmentReviewsQuery', () => ({
  useEquipmentModelSummaryQuery: jest.fn(),
  useEquipmentModelReviewsQuery: jest.fn(),
  useCallerOwnsModelQuery: jest.fn(),
  usePostEquipmentReviewMutation: jest.fn(),
}));

jest.mock('../../services/moderation', () => ({
  reportContent: jest.fn(() => Promise.resolve({ data: 1, error: null })),
  blockUser: jest.fn(() => Promise.resolve({ data: null, error: null })),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }) }));

let mockUser: { id: string } | null = { id: 'me' };
jest.mock('../../hooks/useSession', () => ({ useSession: () => ({ user: mockUser }) }));
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({ s: (key: string, ...args: string[]) => (args.length ? `${key}:${args.join(',')}` : key), lang: 'en' }),
}));
jest.mock('../../hooks/useTheme', () => ({
  // Any color token resolves to a string so StyleSheet never sees undefined.
  useTheme: () => ({ colors: new Proxy({}, { get: (_t, p) => (p === 'then' ? undefined : '#123456') }) }),
}));
jest.mock('../../contexts/OfflineQueueProvider', () => ({ useOfflineQueue: () => ({ isOnline: true }) }));
jest.mock('../../components/Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));
jest.mock('../../components/ReportReasonModal', () => ({
  ReportReasonModal: ({ visible, onSubmit }: any) => {
    const { View, Text } = require('react-native');
    return visible ? (
      <View testID="report-modal">
        <Text onPress={() => onSubmit('spam', undefined)} testID="report-submit">submit</Text>
      </View>
    ) : null;
  },
}));

const mockSummary = useEquipmentModelSummaryQuery as jest.Mock;
const mockReviews = useEquipmentModelReviewsQuery as jest.Mock;
const mockOwns = useCallerOwnsModelQuery as jest.Mock;
const mockPost = usePostEquipmentReviewMutation as jest.Mock;
const mockReport = reportContent as jest.Mock;

const SUMMARY = {
  review_count: 2,
  avg_rating: 4.5,
  avg_speed: 9,
  avg_spin: 7,
  avg_control: 6,
  users_count: 12,
};

const REVIEWS = [
  {
    id: 1, user_id: 'other', category: 'blade', manufacturer_id: 'butterfly', model: 'Viscaria',
    rating: 5, speed: 9, spin: 7, control: 6, time_used: '1_2y', body: 'Loves it',
    author_hand: 'right', author_style: 'attacker', author_grip: 'shakehand',
    flagged: false, flag_count: 0, created_at: '2026-01-01T00:00:00Z',
  },
];

const props = { category: 'blade' as const, manufacturerId: 'butterfly', manufacturer: 'Butterfly', model: 'Viscaria' };

function setup({ owns = false, mutateAsync = jest.fn(() => Promise.resolve(7)) }: { owns?: boolean; mutateAsync?: jest.Mock } = {}) {
  mockSummary.mockReturnValue({ data: SUMMARY, isLoading: false });
  mockReviews.mockReturnValue({ data: REVIEWS, isLoading: false });
  mockOwns.mockReturnValue({ data: owns });
  mockPost.mockReturnValue({ mutateAsync });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'me' };
});

describe('EquipmentModelScreen (F062)', () => {
  it('renders the aggregate summary and the "N players use this" count', () => {
    setup();
    const { getByText } = render(<EquipmentModelScreen {...props} />);
    expect(getByText('4.5')).toBeTruthy();
    expect(getByText('equipReviewCount:2')).toBeTruthy();
    expect(getByText('gearPlayersUseThis:12')).toBeTruthy();
  });

  it('renders the reviews list with the author grip/style snapshot', () => {
    setup();
    const { getByText } = render(<EquipmentModelScreen {...props} />);
    expect(getByText('Loves it')).toBeTruthy();
    // grip + style + hand tags are surfaced from the snapshot.
    expect(getByText('equipmentGripShakehand')).toBeTruthy();
    expect(getByText('equipmentStyleAttacker')).toBeTruthy();
  });

  it('shows the owner gate message when the caller does NOT own the model', () => {
    setup({ owns: false });
    const { getByText, queryByTestId } = render(<EquipmentModelScreen {...props} />);
    expect(getByText('equipReviewOwnerGate')).toBeTruthy();
    expect(queryByTestId('equip-write-review')).toBeNull();
  });

  it('lets an owner open and submit the review form', async () => {
    const mutateAsync = jest.fn(() => Promise.resolve(7));
    setup({ owns: true, mutateAsync });
    const { getByTestId, findByTestId } = render(<EquipmentModelScreen {...props} />);
    fireEvent.press(getByTestId('equip-write-review'));
    // Set a 5-star rating, choose a time bucket, submit (form-scoped testIDs).
    fireEvent.press(await findByTestId('equip-form-star-5'));
    fireEvent.press(getByTestId('equip-time-1_2y'));
    await act(async () => {
      fireEvent.press(getByTestId('equip-review-submit'));
    });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    const arg = (mutateAsync.mock.calls[0] as unknown[])[0];
    expect(arg).toMatchObject({ category: 'blade', manufacturerId: 'butterfly', model: 'Viscaria', rating: 5, timeUsed: '1_2y' });
  });

  it('reports a review through reportContent("equipment_review", id)', async () => {
    setup({ owns: false });
    // The review menu opens a native Alert action sheet; auto-invoke the first
    // (report) button so the report modal opens.
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.[0]?.onPress?.();
    });
    const { getByTestId } = render(<EquipmentModelScreen {...props} />);
    fireEvent.press(getByTestId('equip-review-menu-1'));
    // The report modal is now wired to review #1; submitting calls reportContent.
    // Wrap in act() so the post-resolve state updates flush inside the test.
    await act(async () => {
      fireEvent.press(getByTestId('report-submit'));
    });
    expect(mockReport).toHaveBeenCalledWith('equipment_review', 1, 'spam', undefined);
    alertSpy.mockRestore();
  });
});
