import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';


jest.mock('react-native-maps', () => {
  const RN = require('react-native');
  return { __esModule: true, default: RN.View, Marker: RN.View };
});

jest.mock('../../components/EventDetailSheet', () => ({
  EventDetailSheet: ({ visible, children }: any) => {
    const { View } = require('react-native');
    if (!visible) return null;
    return <View testID="event-detail-sheet">{children}</View>;
  },
}));

jest.mock('../../services/amatur', () => ({
  getAmaturEvents: jest.fn().mockResolvedValue({ data: [], error: null }),
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

const mockPush = jest.fn();
const mockSearchParams: { eventId?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => mockSearchParams,
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(cb, []);
  },
}));

const mockS = jest.fn((key: string) => key);
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({ s: mockS }),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    isDark: false,
  }),
}));

const mockUseSession = jest.fn();
jest.mock('../../hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ unreadCount: 0 }),
}));

jest.mock('../../services/amatur', () => ({
  getAmaturEvents: jest.fn().mockResolvedValue({ data: [], error: null }),
}));

jest.mock('../../components/Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

jest.mock('../../components/Card', () => ({
  Card: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('../../components/NotificationBellButton', () => ({
  NotificationBellButton: () => null,
}));

jest.mock('../../components/SkeletonLoader', () => ({
  EventCardSkeleton: () => null,
  SkeletonList: () => null,
}));

jest.mock('../../components/EmptyState', () => ({
  EmptyState: () => null,
}));

jest.mock('../../components/FriendPickerModal', () => ({
  FriendPickerModal: () => null,
}));

jest.mock('../../lib/haptics', () => ({
  hapticMedium: jest.fn(),
  hapticSelection: jest.fn(),
}));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    FadeInDown: { delay: () => ({ duration: () => ({}) }) },
  };
});

jest.mock('@gorhom/bottom-sheet', () => {
  const { View, TextInput } = require('react-native');
  return {
    __esModule: true,
    default: View,
    BottomSheetView: View,
    BottomSheetScrollView: View,
    BottomSheetBackdrop: () => null,
    BottomSheetTextInput: TextInput,
  };
});

const mockGetEvents = jest.fn();
const mockGetEventParticipants = jest.fn();
const mockGetEventFeedback = jest.fn();
const mockGetUserEventFeedback = jest.fn();
const mockGetUserEventFeedbackForEvents = jest.fn();
const mockGetEventById = jest.fn();

jest.mock('../../services/events', () => ({
  getEvents: (...args: any[]) => mockGetEvents(...args),
  getEventById: (...args: any[]) => mockGetEventById(...args),
  getEventParticipants: (...args: any[]) => mockGetEventParticipants(...args),
  joinEvent: jest.fn().mockResolvedValue({ error: null }),
  leaveEvent: jest.fn().mockResolvedValue({ error: null }),
  cancelEvent: jest.fn().mockResolvedValue({ error: null }),
  stopRecurrence: jest.fn().mockResolvedValue({ error: null }),
  sendEventInvites: jest.fn().mockResolvedValue({ error: null }),
  sendEventUpdate: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('../../services/eventFeedback', () => ({
  getEventFeedback: (...args: any[]) => mockGetEventFeedback(...args),
  getUserEventFeedback: (...args: any[]) => mockGetUserEventFeedback(...args),
  getUserEventFeedbackForEvents: (...args: any[]) => mockGetUserEventFeedbackForEvents(...args),
}));

jest.mock('../../services/friends', () => ({
  getFriendIds: jest.fn().mockResolvedValue([]),
}));

jest.mock('../WriteEventFeedbackScreen', () => ({
  WriteEventFeedbackScreen: ({ visible, eventId, onDismiss }: any) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    if (!visible) return null;
    return (
      <View testID="feedback-modal">
        <Text testID="feedback-event-id">{eventId}</Text>
        <TouchableOpacity testID="feedback-dismiss" onPress={onDismiss} />
      </View>
    );
  },
}));

import { EventSchedulingScreen } from '../EventSchedulingScreen';

const pastEvent = {
  id: 1,
  title: 'Past Tournament',
  starts_at: '2025-01-01T10:00:00Z',
  ends_at: '2025-01-01T14:00:00Z',
  status: 'completed',
  organizer_id: 'org-1',
  venue_id: 5,
  event_type: 'tournament',
  max_participants: 10,
  venues: { name: 'Arena X' },
  event_participants: [{ user_id: 'u-1', joined_at: '2025-01-01T09:00:00Z' }],
};

const cancelledEvent = {
  ...pastEvent,
  id: 2,
  title: 'Cancelled Event',
  status: 'cancelled',
};

const organizerEvent = {
  ...pastEvent,
  id: 3,
  title: 'My Event',
  organizer_id: 'u-1',
};

describe('EventSchedulingScreen — feedback integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete mockSearchParams.eventId;
    mockS.mockImplementation((key: string) => key);
    mockUseSession.mockReturnValue({
      user: { id: 'u-1', user_metadata: { full_name: 'Test' } },
      session: { user: { id: 'u-1' } },
    });
    mockGetEventParticipants.mockResolvedValue({ data: [] });
    mockGetEventFeedback.mockResolvedValue({ data: [] });
    mockGetUserEventFeedback.mockResolvedValue({ data: null });
    mockGetUserEventFeedbackForEvents.mockResolvedValue({ data: [], error: null });
    mockGetEventById.mockResolvedValue({ data: null, error: null });
  });

  it('shows feedback button on past events where user is participant', async () => {
    mockGetEvents.mockResolvedValue({ data: [pastEvent], error: null });
    mockGetUserEventFeedback.mockResolvedValue({ data: null }); // no feedback yet

    const { findByText } = render(<EventSchedulingScreen />);

    // Switch to past tab
    const pastTab = await findByText(/past|trecute/i);
    fireEvent.press(pastTab);

    await waitFor(() => {
      expect(mockGetEvents).toHaveBeenCalledWith('past', 'u-1');
    });
  });

  it('hides feedback button on cancelled events', async () => {
    mockGetEvents.mockResolvedValue({ data: [cancelledEvent], error: null });

    const { findByText, queryByText } = render(<EventSchedulingScreen />);

    const pastTab = await findByText(/past|trecute/i);
    fireEvent.press(pastTab);

    await waitFor(() => {
      expect(queryByText('giveFeedback')).toBeNull();
    });
  });

  it('hides feedback button when user is the organizer', async () => {
    mockGetEvents.mockResolvedValue({ data: [organizerEvent], error: null });

    const { findByText, queryByText } = render(<EventSchedulingScreen />);

    const pastTab = await findByText(/past|trecute/i);
    fireEvent.press(pastTab);

    await waitFor(() => {
      expect(queryByText('giveFeedback')).toBeNull();
    });
  });

  it('hides feedback button when user already gave feedback', async () => {
    mockGetEvents.mockResolvedValue({ data: [pastEvent], error: null });
    mockGetUserEventFeedbackForEvents.mockResolvedValue({ data: [pastEvent.id], error: null }); // already submitted

    const { findByText, queryByText } = render(<EventSchedulingScreen />);

    const pastTab = await findByText(/past|trecute/i);
    fireEvent.press(pastTab);

    await waitFor(() => {
      expect(queryByText('giveFeedback')).toBeNull();
    });
  });

  it('opens feedback modal when feedback button is tapped', async () => {
    mockGetEvents.mockResolvedValue({ data: [pastEvent], error: null });
    mockGetUserEventFeedback.mockResolvedValue({ data: null });

    const { findByText, getByTestId } = render(<EventSchedulingScreen />);

    const pastTab = await findByText(/past|trecute/i);
    fireEvent.press(pastTab);

    const feedbackBtn = await findByText('giveFeedback');
    fireEvent.press(feedbackBtn);

    await waitFor(() => {
      expect(getByTestId('feedback-modal')).toBeTruthy();
      expect(getByTestId('feedback-event-id').props.children).toBe(1);
    });
  });

  it('closes feedback modal on dismiss', async () => {
    mockGetEvents.mockResolvedValue({ data: [pastEvent], error: null });
    mockGetUserEventFeedback.mockResolvedValue({ data: null });

    const { findByText, getByTestId, queryByTestId } = render(<EventSchedulingScreen />);

    const pastTab = await findByText(/past|trecute/i);
    fireEvent.press(pastTab);

    const feedbackBtn = await findByText('giveFeedback');
    fireEvent.press(feedbackBtn);

    await waitFor(() => expect(getByTestId('feedback-modal')).toBeTruthy());

    fireEvent.press(getByTestId('feedback-dismiss'));

    await waitFor(() => {
      expect(queryByTestId('feedback-modal')).toBeNull();
    });
  });
});

describe('EventSchedulingScreen — deep link via eventId param', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete mockSearchParams.eventId;
    mockS.mockImplementation((key: string) => key);
    mockUseSession.mockReturnValue({
      user: { id: 'u-1', user_metadata: { full_name: 'Test' } },
      session: { user: { id: 'u-1' } },
    });
    mockGetEvents.mockResolvedValue({ data: [], error: null });
    mockGetEventParticipants.mockResolvedValue({ data: [] });
    mockGetEventFeedback.mockResolvedValue({ data: [] });
    mockGetUserEventFeedback.mockResolvedValue({ data: null });
    mockGetUserEventFeedbackForEvents.mockResolvedValue({ data: [], error: null });
  });

  it('fetches and opens the event when eventId param is set', async () => {
    mockSearchParams.eventId = '42';
    const event = {
      id: 42,
      title: 'Past Tournament',
      starts_at: '2025-01-01T10:00:00Z',
      ends_at: '2025-01-01T14:00:00Z',
      status: 'completed',
      organizer_id: 'org-1',
      venue_id: 5,
      event_type: 'tournament',
      max_participants: 10,
      venues: { name: 'Arena X' },
      event_participants: [],
    };
    mockGetEventById.mockResolvedValue({ data: event, error: null });

    const { getByTestId } = render(<EventSchedulingScreen />);

    await waitFor(() => {
      expect(mockGetEventById).toHaveBeenCalledWith(42);
      expect(getByTestId('event-detail-sheet')).toBeTruthy();
    });
  });

  it('does not fetch when eventId param is missing', async () => {
    render(<EventSchedulingScreen />);

    await waitFor(() => {
      expect(mockGetEvents).toHaveBeenCalled();
    });
    expect(mockGetEventById).not.toHaveBeenCalled();
  });

  it('ignores non-numeric eventId param', async () => {
    mockSearchParams.eventId = 'not-a-number';

    render(<EventSchedulingScreen />);

    await waitFor(() => {
      expect(mockGetEvents).toHaveBeenCalled();
    });
    expect(mockGetEventById).not.toHaveBeenCalled();
  });

  it('does not open when getEventById returns no data', async () => {
    mockSearchParams.eventId = '99';
    mockGetEventById.mockResolvedValue({ data: null, error: null });

    const { queryByTestId } = render(<EventSchedulingScreen />);

    await waitFor(() => {
      expect(mockGetEventById).toHaveBeenCalledWith(99);
    });
    expect(queryByTestId('event-detail-sheet')).toBeNull();
  });
});
