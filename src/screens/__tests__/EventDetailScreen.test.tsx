import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSearchParams: { eventId?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../theme').lightColors,
    isDark: false,
  }),
}));

const mockS = jest.fn((key: string) => key);
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({ s: mockS, lang: 'en' }),
}));

const mockUseSession = jest.fn();
jest.mock('../../hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

const mockGetEventById = jest.fn();
const mockGetEventParticipants = jest.fn();
const mockCloseEvent = jest.fn();
const mockCancelEvent = jest.fn();
jest.mock('../../services/events', () => ({
  getEventById: (...args: any[]) => mockGetEventById(...args),
  getEventParticipants: (...args: any[]) => mockGetEventParticipants(...args),
  joinEvent: jest.fn().mockResolvedValue({ error: null }),
  leaveEvent: jest.fn().mockResolvedValue({ error: null }),
  closeEvent: (...args: any[]) => mockCloseEvent(...args),
  cancelEvent: (...args: any[]) => mockCancelEvent(...args),
  sendEventInvites: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('../../services/eventFeedback', () => ({
  getEventFeedback: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../services/friends', () => ({
  getFriendIds: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../lib/eventsCache', () => ({
  invalidateEventsCache: jest.fn(),
}));

jest.mock('../../lib/haptics', () => ({
  hapticMedium: jest.fn(),
}));

jest.mock('../../lib/analytics', () => ({
  trackProductEvent: jest.fn(),
  ProductEvents: {
    eventOpened: 'event_opened',
    eventJoined: 'event_joined',
    eventChallengeAttached: 'event_challenge_attached',
    eventChallengeAwarded: 'event_challenge_awarded',
  },
}));

jest.mock('../../features/challenges', () => ({
  requiresOtherPlayer: jest.fn().mockReturnValue(false),
  resolveChallengeTitle: jest.fn(),
  setCurrentSelectedChallenge: jest.fn(),
  useChallengeChoices: () => ({ choices: [] }),
  useCurrentSelectedChallenge: () => null,
  useEventChallenges: () => ({
    addChallenge: jest.fn(),
    awardChallenge: jest.fn(),
    challenges: [],
  }),
}));

jest.mock('../../lib/badgeChallenges', () => ({
  BADGE_TRACKS: [{ id: 'track-1', category: 'cat-1' }],
}));

// Mock the heavy detail content; the screen-level concerns we care about
// are the header, the back button, and the getEventById call — not the
// internals of the body, which has its own coverage path.
jest.mock('../EventSchedulingScreen/EventDetailContent', () => ({
  EventDetailContent: ({ event, onCloseEvent, onCancelEvent }: any) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    return (
      <View testID="event-detail-content">
        <Text testID="event-title">{event?.title}</Text>
        <Text testID="event-status">{event?.status}</Text>
        <TouchableOpacity testID="close-event-action" onPress={onCloseEvent}>
          <Text>close</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="cancel-event-action" onPress={onCancelEvent}>
          <Text>cancel</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock('../../components/FriendPickerModal', () => ({
  FriendPickerModal: () => null,
}));

jest.mock('../../components/LogHoursModal', () => ({
  LogHoursModal: () => null,
}));

jest.mock('../WriteEventFeedbackScreen', () => ({
  WriteEventFeedbackScreen: () => null,
}));

jest.mock('../../components/Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

import { EventDetailScreen } from '../EventDetailScreen';

const sampleEvent = {
  id: 42,
  title: 'Friday Match',
  starts_at: '2026-05-08T18:00:00Z',
  ends_at: '2026-05-08T20:00:00Z',
  status: 'open',
  event_type: 'casual',
  organizer_id: 'org-1',
  visibility: 'public',
  venues: { name: 'Parcul Carol' },
  event_participants: [],
};

const inProgressEvent = {
  ...sampleEvent,
  starts_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  ends_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};

const upcomingEvent = {
  ...sampleEvent,
  starts_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  ends_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
};

describe('EventDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockS.mockImplementation((key: string) => key);
    mockUseSession.mockReturnValue({ user: { id: 'u-1' }, session: { user: { id: 'u-1' } } });
    mockSearchParams.eventId = '42';
    mockGetEventById.mockResolvedValue({ data: sampleEvent, error: null });
    mockGetEventParticipants.mockResolvedValue({ data: [] });
    mockCloseEvent.mockResolvedValue({ data: { id: 42, status: 'closed' }, error: null });
    mockCancelEvent.mockResolvedValue({ data: { id: 42, status: 'cancelled' }, error: null });
  });

  it('fetches the event by id from the route param', async () => {
    render(<EventDetailScreen />);
    await waitFor(() => {
      expect(mockGetEventById).toHaveBeenCalledWith(42);
    });
  });

  it('renders the eventDetails header (not the event title) so it does not duplicate the in-page title', async () => {
    const { findByText } = render(<EventDetailScreen />);
    // The header reads from i18n key 'eventDetails'; the in-page title
    // ('Friday Match') is rendered separately by EventDetailContent.
    expect(await findByText('eventDetails')).toBeTruthy();
  });

  it('back button calls router.back', async () => {
    const { findAllByTestId } = render(<EventDetailScreen />);
    const backIcons = await findAllByTestId('icon-chevron-left');
    fireEvent.press(backIcons[0]);
    expect(mockBack).toHaveBeenCalled();
  });

  it('renders the not-found state when getEventById returns no data', async () => {
    mockGetEventById.mockResolvedValue({ data: null, error: null });
    const { findByText } = render(<EventDetailScreen />);
    expect(await findByText('eventNotFound')).toBeTruthy();
  });

  it('renders the not-found state when the eventId param is non-numeric', async () => {
    mockSearchParams.eventId = 'not-a-number';
    const { findByText } = render(<EventDetailScreen />);
    expect(await findByText('eventNotFound')).toBeTruthy();
    // Should not even attempt the fetch.
    expect(mockGetEventById).not.toHaveBeenCalled();
  });

  it('passes the fetched event through to EventDetailContent', async () => {
    const { findByTestId } = render(<EventDetailScreen />);
    const titleNode = await findByTestId('event-title');
    expect(titleNode.props.children).toBe('Friday Match');
  });

  it('closes the event through the detail screen owner flow', async () => {
    mockUseSession.mockReturnValue({ user: { id: 'org-1' }, session: { user: { id: 'org-1' } } });
    mockGetEventById.mockResolvedValue({ data: inProgressEvent, error: null });
    const { findByTestId } = render(<EventDetailScreen />);
    fireEvent.press(await findByTestId('close-event-action'));

    await waitFor(() => {
      expect(mockCloseEvent).toHaveBeenCalledWith(42, 'org-1');
    });
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(expect.stringMatching(/^\/\(tabs\)\/events\?tab=upcoming&refreshEvents=\d+$/));
  });

  it('does not close an event before it has started', async () => {
    mockUseSession.mockReturnValue({ user: { id: 'org-1' }, session: { user: { id: 'org-1' } } });
    mockGetEventById.mockResolvedValue({ data: upcomingEvent, error: null });
    const { findByTestId } = render(<EventDetailScreen />);
    fireEvent.press(await findByTestId('close-event-action'));

    expect(mockCloseEvent).not.toHaveBeenCalled();
  });

  it('cancels the event through the detail screen owner flow', async () => {
    mockUseSession.mockReturnValue({ user: { id: 'org-1' }, session: { user: { id: 'org-1' } } });
    const { findByTestId } = render(<EventDetailScreen />);
    fireEvent.press(await findByTestId('cancel-event-action'));

    await waitFor(() => {
      expect(mockCancelEvent).toHaveBeenCalledWith(42, 'org-1');
    });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('does not let a non-organizer close or cancel the event', async () => {
    const { findByTestId } = render(<EventDetailScreen />);

    fireEvent.press(await findByTestId('close-event-action'));
    fireEvent.press(await findByTestId('cancel-event-action'));

    expect(mockCloseEvent).not.toHaveBeenCalled();
    expect(mockCancelEvent).not.toHaveBeenCalled();
  });
});
