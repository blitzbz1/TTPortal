import { getOfflineHandler } from '../offlineHandlers';
import type { QueuedChange } from '../offlineQueue';

const mockCheckin = jest.fn();
const mockGetActive = jest.fn();
jest.mock('../../services/checkins', () => ({
  checkin: (...a: any[]) => mockCheckin(...a),
  getUserAnyActiveCheckin: (...a: any[]) => mockGetActive(...a),
}));

const mockAddFavorite = jest.fn();
const mockRemoveFavorite = jest.fn();
jest.mock('../../services/favorites', () => ({
  addFavorite: (...a: any[]) => mockAddFavorite(...a),
  removeFavorite: (...a: any[]) => mockRemoveFavorite(...a),
}));

jest.mock('../../services/notifications', () => ({
  markAsRead: jest.fn(() => Promise.resolve({})),
  deleteNotification: jest.fn(() => Promise.resolve({})),
}));

const mockInvalidate = jest.fn();
jest.mock('../queryClient', () => ({
  queryClient: { invalidateQueries: (...a: any[]) => mockInvalidate(...a) },
}));

jest.mock('../logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(), track: jest.fn() },
}));

function change(entityType: string, payload: unknown): QueuedChange {
  return {
    id: 'c1', entityType, entityId: 'e1', operation: 'create',
    payload, enqueuedAt: Date.now(), attempts: 0,
  };
}

const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
const oneHourAgo = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();

describe('checkin replay handler', () => {
  const handler = getOfflineHandler('checkin')!;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckin.mockResolvedValue({ data: { id: 1 }, error: null });
    mockGetActive.mockResolvedValue({ data: null, error: null });
  });

  it('replays with the original timestamps when nothing conflicts', async () => {
    const payload = { user_id: 'u1', venue_id: 5, started_at: oneHourAgo(), ended_at: inOneHour() };
    await handler(change('checkin', payload));

    expect(mockCheckin).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'u1', venue_id: 5, started_at: payload.started_at, ended_at: payload.ended_at,
    }));
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['venue-detail', 5] });
  });

  it('inserts already-ended check-ins without consulting current presence', async () => {
    const payload = { user_id: 'u1', venue_id: 5, started_at: oneHourAgo(), ended_at: oneHourAgo() };
    await handler(change('checkin', payload));

    expect(mockGetActive).not.toHaveBeenCalled();
    expect(mockCheckin).toHaveBeenCalled();
  });

  it('closes the queued (older) check-in when the user is now active at another venue', async () => {
    mockGetActive.mockResolvedValue({ data: { id: 9, venue_id: 7 }, error: null });
    const payload = { user_id: 'u1', venue_id: 5, started_at: oneHourAgo(), ended_at: inOneHour() };

    await handler(change('checkin', payload));

    const inserted = mockCheckin.mock.calls[0][0];
    expect(new Date(inserted.ended_at).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('no-ops when a live check-in at the same venue supersedes the queued one', async () => {
    mockGetActive.mockResolvedValue({ data: { id: 9, venue_id: 5 }, error: null });
    const payload = { user_id: 'u1', venue_id: 5, started_at: oneHourAgo(), ended_at: inOneHour() };

    const result = await handler(change('checkin', payload));

    expect(mockCheckin).not.toHaveBeenCalled();
    expect(result).toBeUndefined(); // clean resolve → dequeued
  });

  it('propagates service errors so the change stays queued', async () => {
    mockCheckin.mockResolvedValue({ data: null, error: { message: 'rate_limit' } });
    const payload = { user_id: 'u1', venue_id: 5, started_at: oneHourAgo(), ended_at: oneHourAgo() };

    const result = await handler(change('checkin', payload));

    expect(result).toEqual({ error: { message: 'rate_limit' } });
  });
});

describe('favorite replay handler', () => {
  const handler = getOfflineHandler('favorite')!;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAddFavorite.mockResolvedValue({ error: null });
    mockRemoveFavorite.mockResolvedValue({ error: null });
  });

  it('adds and invalidates the favorites key', async () => {
    await handler(change('favorite', { userId: 'u1', venueId: 3, operation: 'add' }));
    expect(mockAddFavorite).toHaveBeenCalledWith('u1', 3);
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['favorites', 'u1'] });
  });

  it('removes on the remove operation', async () => {
    await handler(change('favorite', { userId: 'u1', venueId: 3, operation: 'remove' }));
    expect(mockRemoveFavorite).toHaveBeenCalledWith('u1', 3);
  });

  it('returns the error so the change stays queued', async () => {
    mockAddFavorite.mockResolvedValue({ error: { message: 'boom' } });
    const result = await handler(change('favorite', { userId: 'u1', venueId: 3, operation: 'add' }));
    expect(result).toEqual({ error: { message: 'boom' } });
  });
});
