import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
}));

const mockS = jest.fn((key: string) => key);
jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({ s: mockS, lang: 'en' as const }),
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

jest.mock('../../components/Icon', () => ({
  Lucide: ({ name, ...props }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} {...props} />;
  },
}));

const mockGetProfile = jest.fn();
const mockGetProfileStats = jest.fn();
jest.mock('../../services/profiles', () => ({
  getProfile: (...args: any[]) => mockGetProfile(...args),
  getProfileStats: (...args: any[]) => mockGetProfileStats(...args),
}));

const mockGetEvents = jest.fn();
const mockSendEventInvites = jest.fn();
jest.mock('../../services/events', () => ({
  getEvents: (...args: any[]) => mockGetEvents(...args),
  sendEventInvites: (...args: any[]) => mockSendEventInvites(...args),
}));

const mockGetCurrentEquipmentForUser = jest.fn();
jest.mock('../../services/equipment', () => ({
  getCurrentEquipmentForUser: (...args: any[]) => mockGetCurrentEquipmentForUser(...args),
}));

import { PlayerProfileScreen } from '../PlayerProfileScreen';

const targetProfile = {
  id: 'target-1',
  full_name: 'Andrei Popescu',
  username: 'andreip',
  city: 'București',
  is_admin: false,
};

describe('PlayerProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({
      user: { id: 'me-1', user_metadata: { full_name: 'Me' } },
    });
    mockGetProfile.mockResolvedValue({ data: targetProfile, error: null });
    mockGetProfileStats.mockResolvedValue({
      data: {
        total_checkins: 12,
        unique_venues: 5,
        events_joined: 3,
        total_hours_played: 7.5,
      },
      error: null,
    });
    mockGetEvents.mockResolvedValue({ data: [], error: null });
    mockSendEventInvites.mockResolvedValue({ error: null });
    mockGetCurrentEquipmentForUser.mockResolvedValue({ data: [], error: null });
  });

  it('renders profile name, username, and city', async () => {
    const { findByText } = render(<PlayerProfileScreen userId="target-1" />);
    expect(await findByText('Andrei Popescu')).toBeTruthy();
    expect(await findByText('@andreip · București')).toBeTruthy();
  });

  it('renders all four stat values including hours in events', async () => {
    const { findByText } = render(<PlayerProfileScreen userId="target-1" />);
    expect(await findByText('12')).toBeTruthy(); // checkins
    expect(await findByText('5')).toBeTruthy();  // unique_venues
    expect(await findByText('3')).toBeTruthy();  // events joined
    expect(await findByText('7.5h')).toBeTruthy(); // hours in events
    expect(await findByText('hoursInEvents')).toBeTruthy();
  });

  it('formats sub-hour totals as minutes', async () => {
    mockGetProfileStats.mockResolvedValue({
      data: { total_checkins: 0, unique_venues: 0, events_joined: 0, total_hours_played: 0.5 },
      error: null,
    });
    const { findByText } = render(<PlayerProfileScreen userId="target-1" />);
    expect(await findByText('30min')).toBeTruthy();
  });

  it('shows the invite-to-event button when viewing another user', async () => {
    const { findByText } = render(<PlayerProfileScreen userId="target-1" />);
    expect(await findByText('inviteToEvent')).toBeTruthy();
  });

  it('hides the invite-to-event button when viewing self', async () => {
    const { findByText, queryByText } = render(<PlayerProfileScreen userId="me-1" />);
    // Wait until profile loads
    await findByText('Andrei Popescu');
    expect(queryByText('inviteToEvent')).toBeNull();
  });

  it('opens the picker and lists upcoming organizer events', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    mockGetEvents.mockResolvedValue({
      data: [
        {
          id: 7,
          title: 'Saturday Pickup',
          status: 'open',
          starts_at: future,
          venues: { name: 'Arena X' },
        },
      ],
      error: null,
    });

    const { findByText } = render(<PlayerProfileScreen userId="target-1" />);
    fireEvent.press(await findByText('inviteToEvent'));

    expect(await findByText('Saturday Pickup')).toBeTruthy();
    await waitFor(() => {
      expect(mockGetEvents).toHaveBeenCalledWith('mine', 'me-1');
    });
  });

  it('filters out cancelled and past events from the picker', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();
    mockGetEvents.mockResolvedValue({
      data: [
        { id: 1, title: 'Old Event', status: 'completed', starts_at: past, venues: { name: 'A' } },
        { id: 2, title: 'Cancelled Event', status: 'cancelled', starts_at: future, venues: { name: 'B' } },
        { id: 3, title: 'Live Event', status: 'open', starts_at: future, venues: { name: 'C' } },
      ],
      error: null,
    });

    const { findByText, queryByText } = render(<PlayerProfileScreen userId="target-1" />);
    fireEvent.press(await findByText('inviteToEvent'));

    expect(await findByText('Live Event')).toBeTruthy();
    expect(queryByText('Old Event')).toBeNull();
    expect(queryByText('Cancelled Event')).toBeNull();
  });

  it('shows empty state when organizer has no upcoming events', async () => {
    mockGetEvents.mockResolvedValue({ data: [], error: null });

    const { findByText } = render(<PlayerProfileScreen userId="target-1" />);
    fireEvent.press(await findByText('inviteToEvent'));

    expect(await findByText('noUpcomingEvents')).toBeTruthy();
  });

  it('renders the target user\'s current equipment when available', async () => {
    mockGetCurrentEquipmentForUser.mockResolvedValue({
      data: [
        {
          id: 1,
          user_id: 'target-1',
          blade_manufacturer: 'Butterfly',
          blade_model: 'Viscaria',
          forehand_rubber_manufacturer: 'Butterfly',
          forehand_rubber_model: 'Tenergy 05',
          forehand_rubber_color: 'red',
          backhand_rubber_manufacturer: 'Butterfly',
          backhand_rubber_model: 'Dignics 09c',
          backhand_rubber_color: 'black',
          dominant_hand: 'right',
          playing_style: 'attacker',
          grip: 'shakehand',
        },
      ],
      error: null,
    });

    const { findByText } = render(<PlayerProfileScreen userId="target-1" />);
    expect(await findByText('Butterfly Viscaria')).toBeTruthy();
    expect(await findByText(/Tenergy 05/)).toBeTruthy();
    expect(await findByText(/Dignics 09c/)).toBeTruthy();
    expect(await findByText('equipmentStyleAttacker')).toBeTruthy();
  });

  it('shows an equipment empty state when the player has no setup saved', async () => {
    mockGetCurrentEquipmentForUser.mockResolvedValue({ data: [], error: null });
    const { findByText } = render(<PlayerProfileScreen userId="target-1" />);
    expect(await findByText('equipmentFriendEmptyTitle')).toBeTruthy();
  });

  it('sends an invite for the picked event with the target user id', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    mockGetEvents.mockResolvedValue({
      data: [
        { id: 11, title: 'My Match', status: 'open', starts_at: future, venues: { name: 'V' } },
      ],
      error: null,
    });

    const { findByText } = render(<PlayerProfileScreen userId="target-1" />);
    fireEvent.press(await findByText('inviteToEvent'));
    fireEvent.press(await findByText('My Match'));

    await waitFor(() => {
      expect(mockSendEventInvites).toHaveBeenCalledWith(11, ['target-1'], 'me-1');
    });
  });
});
