jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({}),
}));

const mockUser = { id: 'user-123' };
jest.mock('../../../hooks/useSession', () => ({
  useSession: () => ({ user: mockUser }),
}));

const mockCreateEvent = jest.fn();
const mockJoinEvent = jest.fn();
const mockSendEventInvites = jest.fn();
jest.mock('../../../services/events', () => ({
  createEvent: (...args: any[]) => mockCreateEvent(...args),
  joinEvent: (...args: any[]) => mockJoinEvent(...args),
  sendEventInvites: (...args: any[]) => mockSendEventInvites(...args),
}));

const mockGetVenues = jest.fn();
const mockSearchVenues = jest.fn();
jest.mock('../../../services/venues', () => ({
  getVenues: (...args: any[]) => mockGetVenues(...args),
  searchVenues: (...args: any[]) => mockSearchVenues(...args),
}));

const mockGetFriends = jest.fn();
jest.mock('../../../services/friends', () => ({
  getFriends: (...args: any[]) => mockGetFriends(...args),
}));

jest.mock('../../../hooks/useI18n', () => ({
  useI18n: () => ({ s: (key: string) => key, lang: 'en' }),
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View testID={`picker-${props.mode}`} />,
  };
});

jest.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: require('../../../theme').lightColors,
    mode: 'light',
    resolved: 'light',
    isDark: false,
    setMode: jest.fn(),
  }),
}));

 
import React from 'react';
 
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
 
import CreateEventRoute from '../create-event';

const venues = [
  { id: 1, name: 'Parcul Herăstrău', city: 'București', type: 'parc_exterior' },
  { id: 2, name: 'Sala Sporturilor', city: 'Cluj', type: 'sala_indoor' },
];

const friends = [
  {
    id: 1, requester_id: 'user-123', addressee_id: 'friend-1', status: 'accepted',
    requester: { id: 'user-123', full_name: 'Me', city: 'București' },
    addressee: { id: 'friend-1', full_name: 'Andrei P.', city: 'București' },
  },
  {
    id: 2, requester_id: 'friend-2', addressee_id: 'user-123', status: 'accepted',
    requester: { id: 'friend-2', full_name: 'Maria I.', city: 'Cluj' },
    addressee: { id: 'user-123', full_name: 'Me', city: 'București' },
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockCreateEvent.mockResolvedValue({ data: { id: 42 }, error: null });
  mockJoinEvent.mockResolvedValue({ data: null, error: null });
  mockSendEventInvites.mockResolvedValue({ data: null, error: null });
  mockGetVenues.mockResolvedValue({ data: venues, error: null });
  mockSearchVenues.mockResolvedValue({ data: [], error: null });
  mockGetFriends.mockResolvedValue({ data: friends, error: null });
});

afterEach(() => { jest.useRealTimers(); });

/** Helper: expand a collapsible section by its title */
function openSection(title: string) {
  fireEvent.press(screen.getByText(title));
}

describe('CreateEventRoute – essentials', () => {
  it('renders title input and date/time buttons', () => {
    render(<CreateEventRoute />);
    expect(screen.getByPlaceholderText('Titlu eveniment *')).toBeTruthy();
    expect(screen.getByPlaceholderText('Descriere (opțional)')).toBeTruthy();
  });

  it('shows date picker when date button is tapped and hides on time tap', () => {
    render(<CreateEventRoute />);
    // Pickers hidden by default
    expect(screen.queryByTestId('picker-date')).toBeNull();
    expect(screen.queryByTestId('picker-time')).toBeNull();

    // Tap time button (shows "18:00")
    fireEvent.press(screen.getByText('18:00'));
    expect(screen.getByTestId('picker-time')).toBeTruthy();
    expect(screen.queryByTestId('picker-date')).toBeNull();
  });

  it('passes starts_at without ends_at by default', async () => {
    render(<CreateEventRoute />);
    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Test');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });

    const args = mockCreateEvent.mock.calls[0][0];
    expect(new Date(args.starts_at).toISOString()).toBe(args.starts_at);
    expect(args.ends_at).toBeUndefined();
    expect(args.max_participants).toBeUndefined();
  });

  it('auto-joins the organizer after creation', async () => {
    render(<CreateEventRoute />);
    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Test');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });
    expect(mockJoinEvent).toHaveBeenCalledWith(42, 'user-123');
  });

  it('shows error alert when createEvent fails (admin-typical path: generic error)', async () => {
    // An admin is exempt from rate limiting, so any error they see is a
    // real failure — the screen must fall through to the generic copy.
    mockCreateEvent.mockResolvedValue({ data: null, error: { message: 'fail' } });
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    render(<CreateEventRoute />);
    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Test');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });
    expect(alertSpy).toHaveBeenCalledWith('error', 'Nu s-a putut crea evenimentul.');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('shows the localized rate-limit copy when a normal user trips the limit', async () => {
    // The DB trigger raises a structured exception; PostgREST surfaces it
    // on `error.message`. The screen must translate it into the localized
    // i18n copy instead of the generic fallback.
    mockCreateEvent.mockResolvedValue({
      data: null,
      error: { message: 'rate_limit_exceeded:user:create_event:86400:10' },
    });
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    render(<CreateEventRoute />);
    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Test');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });
    // i18n mock returns the key — proves the rateLimit branch was taken
    // and that the action is mapped to rateLimitCreateEvent specifically.
    expect(alertSpy).toHaveBeenCalledWith('error', 'rateLimitCreateEvent');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('shows the IP-blocked copy when the request is denied at the IP layer', async () => {
    mockCreateEvent.mockResolvedValue({
      data: null,
      error: { message: 'ip_blocked:203.0.113.5' },
    });
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
    render(<CreateEventRoute />);
    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Test');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });
    expect(alertSpy).toHaveBeenCalledWith('error', 'rateLimitIpBlocked');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('does not call createEvent when title is empty', async () => {
    render(<CreateEventRoute />);
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });
});

describe('CreateEventRoute – collapsible sections', () => {
  it('venue picker is always visible', () => {
    render(<CreateEventRoute />);
    expect(screen.getByText('Alege locația')).toBeTruthy();
  });

  it('Opțiuni section is collapsed with default summary', () => {
    render(<CreateEventRoute />);
    expect(screen.getByText('Opțiuni')).toBeTruthy();
    expect(screen.getByText('Casual')).toBeTruthy();
    expect(screen.queryByText('Tip eveniment')).toBeNull();
  });

  it('expands Opțiuni section to show event type toggle', () => {
    render(<CreateEventRoute />);
    openSection('Opțiuni');
    expect(screen.getByText('Tip eveniment')).toBeTruthy();
  });

  it('Opțiuni summary updates when options change', async () => {
    render(<CreateEventRoute />);
    openSection('Opțiuni');
    // Select duration
    fireEvent.press(screen.getByText('Fără'));
    fireEvent.press(screen.getByText('2h'));
    // Set max participants
    fireEvent.changeText(screen.getByPlaceholderText('ex: 6'), '8');
    // Collapse to see summary
    openSection('Opțiuni');
    expect(screen.getByText(/Casual · 2h · 8 locuri/)).toBeTruthy();
  });
});

describe('CreateEventRoute – venue picker', () => {
  it('opens venue modal and shows venues', async () => {
    render(<CreateEventRoute />);
    fireEvent.press(screen.getByText('Alege locația'));
    await act(async () => { jest.runAllTimers(); });
    await waitFor(() => {
      expect(screen.getByText('Parcul Herăstrău')).toBeTruthy();
      expect(screen.getByText('Sala Sporturilor')).toBeTruthy();
    });
  });

  it('passes venue_id to createEvent when a venue is selected', async () => {
    render(<CreateEventRoute />);
    fireEvent.press(screen.getByText('Alege locația'));
    await act(async () => { jest.runAllTimers(); });
    await waitFor(() => { expect(screen.getByText('Parcul Herăstrău')).toBeTruthy(); });
    fireEvent.press(screen.getByText('Parcul Herăstrău'));

    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Meci');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });
    expect(mockCreateEvent).toHaveBeenCalledWith(expect.objectContaining({ venue_id: 1 }));
  });

  it('sends venue_id as undefined when no venue is selected', async () => {
    render(<CreateEventRoute />);
    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Test');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });
    expect(mockCreateEvent).toHaveBeenCalledWith(expect.objectContaining({ venue_id: undefined }));
  });
});

describe('CreateEventRoute – duration & recurrence', () => {
  it('shows duration dropdown for casual events', () => {
    render(<CreateEventRoute />);
    openSection('Opțiuni');
    expect(screen.getByText('Durată (opțional)')).toBeTruthy();
    expect(screen.getByText('Fără')).toBeTruthy();
  });

  it('sets ends_at when a duration is selected', async () => {
    render(<CreateEventRoute />);
    openSection('Opțiuni');
    fireEvent.press(screen.getByText('Fără'));
    fireEvent.press(screen.getByText('3h'));

    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Test');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });

    const args = mockCreateEvent.mock.calls[0][0];
    expect(new Date(args.ends_at).getTime() - new Date(args.starts_at).getTime()).toBe(3 * 3600000);
  });

  it('clears ends_at when Fără is reselected', async () => {
    render(<CreateEventRoute />);
    openSection('Opțiuni');
    fireEvent.press(screen.getByText('Fără'));
    fireEvent.press(screen.getByText('2h'));
    fireEvent.press(screen.getByText('2h'));
    fireEvent.press(screen.getByText('Fără'));

    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Test');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });
    expect(mockCreateEvent.mock.calls[0][0].ends_at).toBeUndefined();
  });

  it('shows recurrence dropdown for casual events', () => {
    render(<CreateEventRoute />);
    openSection('Opțiuni');
    expect(screen.getByText('Recurență')).toBeTruthy();
    expect(screen.getByText('Niciuna')).toBeTruthy();
  });

  it('passes recurrence_rule weekly via dropdown', async () => {
    render(<CreateEventRoute />);
    openSection('Opțiuni');
    fireEvent.press(screen.getByText('Niciuna'));
    fireEvent.press(screen.getByText('Săptămânal'));

    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Test');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });

    const args = mockCreateEvent.mock.calls[0][0];
    expect(args.recurrence_rule).toBe('weekly');
    expect(args.recurrence_day).toBeGreaterThanOrEqual(0);
    expect(args.recurrence_day).toBeLessThanOrEqual(6);
  });

  it('passes recurrence_rule daily via dropdown', async () => {
    render(<CreateEventRoute />);
    openSection('Opțiuni');
    fireEvent.press(screen.getByText('Niciuna'));
    fireEvent.press(screen.getByText('Zilnic'));

    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Test');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });
    expect(mockCreateEvent.mock.calls[0][0].recurrence_rule).toBe('daily');
  });

  it('passes recurrence_rule monthly with recurrence_day', async () => {
    render(<CreateEventRoute />);
    openSection('Opțiuni');
    fireEvent.press(screen.getByText('Niciuna'));
    fireEvent.press(screen.getByText('Lunar'));

    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Test');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });

    const args = mockCreateEvent.mock.calls[0][0];
    expect(args.recurrence_rule).toBe('monthly');
    expect(args.recurrence_day).toBeGreaterThanOrEqual(1);
    expect(args.recurrence_day).toBeLessThanOrEqual(31);
  });

  it('does not pass recurrence_rule by default', async () => {
    render(<CreateEventRoute />);
    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Test');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });
    expect(mockCreateEvent.mock.calls[0][0].recurrence_rule).toBeUndefined();
  });

  it('shows daily recurrence hint', () => {
    render(<CreateEventRoute />);
    openSection('Opțiuni');
    fireEvent.press(screen.getByText('Niciuna'));
    fireEvent.press(screen.getByText('Zilnic'));
    expect(screen.getByText('Se repetă în fiecare zi')).toBeTruthy();
  });

  it('shows weekly recurrence hint', () => {
    render(<CreateEventRoute />);
    openSection('Opțiuni');
    fireEvent.press(screen.getByText('Niciuna'));
    fireEvent.press(screen.getByText('Săptămânal'));
    expect(screen.getByText(/Se repetă în fiecare/)).toBeTruthy();
  });

  it('shows monthly recurrence hint', () => {
    render(<CreateEventRoute />);
    openSection('Opțiuni');
    fireEvent.press(screen.getByText('Niciuna'));
    fireEvent.press(screen.getByText('Lunar'));
    expect(screen.getByText(/Se repetă pe \d+ ale fiecărei luni/)).toBeTruthy();
  });

  it('does not show recurrence hint by default', () => {
    render(<CreateEventRoute />);
    expect(screen.queryByText(/Se repetă/)).toBeNull();
  });
});

describe('CreateEventRoute – tournament', () => {
  it('hides recurrence/duration for tournament, shows end date', () => {
    render(<CreateEventRoute />);
    openSection('Opțiuni');
    fireEvent.press(screen.getByText('Turneu'));
    expect(screen.getByText('Data final')).toBeTruthy();
    expect(screen.queryByText('Durată (opțional)')).toBeNull();
    expect(screen.queryByText('Recurență')).toBeNull();
  });

  it('passes event_type tournament with ends_at', async () => {
    render(<CreateEventRoute />);
    openSection('Opțiuni');
    fireEvent.press(screen.getByText('Turneu'));

    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Cupa');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });

    const args = mockCreateEvent.mock.calls[0][0];
    expect(args.event_type).toBe('tournament');
    expect(args.ends_at).toEqual(expect.any(String));
    expect(new Date(args.ends_at).getTime()).toBeGreaterThan(new Date(args.starts_at).getTime());
  });

  it('clears recurrence when switching to tournament', async () => {
    render(<CreateEventRoute />);
    openSection('Opțiuni');
    fireEvent.press(screen.getByText('Niciuna'));
    fireEvent.press(screen.getByText('Săptămânal'));
    fireEvent.press(screen.getByText('Turneu'));

    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Cupa');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });
    expect(mockCreateEvent.mock.calls[0][0].recurrence_rule).toBeUndefined();
  });
});

describe('CreateEventRoute – max participants', () => {
  it('passes max_participants when entered', async () => {
    render(<CreateEventRoute />);
    openSection('Opțiuni');
    fireEvent.changeText(screen.getByPlaceholderText('ex: 6'), '10');
    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Test');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });
    expect(mockCreateEvent).toHaveBeenCalledWith(expect.objectContaining({ max_participants: 10 }));
  });

  it('omits max_participants when left empty', async () => {
    render(<CreateEventRoute />);
    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Test');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });
    expect(mockCreateEvent.mock.calls[0][0].max_participants).toBeUndefined();
  });
});

describe('CreateEventRoute – friend invites', () => {
  it('shows friend picker after successful event creation', async () => {
    render(<CreateEventRoute />);
    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Test');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });
    await act(async () => { jest.runAllTimers(); });
    await waitFor(() => {
      expect(mockGetFriends).toHaveBeenCalledWith('user-123');
      expect(screen.getByText('Andrei P.')).toBeTruthy();
      expect(screen.getByText('Maria I.')).toBeTruthy();
    });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('sends invites when friends are selected and confirmed', async () => {
    render(<CreateEventRoute />);
    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Test');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });
    await act(async () => { jest.runAllTimers(); });
    await waitFor(() => { expect(screen.getByText('Andrei P.')).toBeTruthy(); });

    fireEvent.press(screen.getByText('Andrei P.'));
    const confirmButtons = screen.getAllByText(/inviteToEvent/);
    fireEvent.press(confirmButtons[confirmButtons.length - 1]);
    await act(async () => {});

    expect(mockSendEventInvites).toHaveBeenCalledWith(42, ['friend-1'], 'user-123');
    expect(mockBack).toHaveBeenCalled();
  });

  it('skips invites and navigates back when skip is pressed', async () => {
    render(<CreateEventRoute />);
    fireEvent.changeText(screen.getByPlaceholderText('Titlu eveniment *'), 'Test');
    await act(async () => { fireEvent.press(screen.getByText('Creează')); });
    await act(async () => { jest.runAllTimers(); });
    await waitFor(() => { expect(screen.getByText('Andrei P.')).toBeTruthy(); });

    fireEvent.press(screen.getByText(/skip/i));
    expect(mockSendEventInvites).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });
});
