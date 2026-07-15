import { buildRouteFromNotificationData } from '../notificationRoutes';

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    track: jest.fn(),
  },
}));

describe('buildRouteFromNotificationData', () => {
  it('returns null when data is missing or has no screen', () => {
    expect(buildRouteFromNotificationData(null)).toBeNull();
    expect(buildRouteFromNotificationData(undefined)).toBeNull();
    expect(buildRouteFromNotificationData({})).toBeNull();
    expect(buildRouteFromNotificationData({ eventId: 5 })).toBeNull();
    expect(buildRouteFromNotificationData({ screen: '' })).toBeNull();
    expect(buildRouteFromNotificationData({ screen: 42 })).toBeNull();
  });

  it('returns the sanitized screen when there is no event id', () => {
    expect(buildRouteFromNotificationData({ screen: '/(protected)/events' })).toBe(
      '/(protected)/events',
    );
  });

  it('appends camelCase eventId as a query param', () => {
    expect(
      buildRouteFromNotificationData({ screen: '/(protected)/events', eventId: 7 }),
    ).toBe('/(protected)/events?eventId=7');
    expect(
      buildRouteFromNotificationData({ screen: '/(protected)/events', eventId: '7' }),
    ).toBe('/(protected)/events?eventId=7');
  });

  it('handles snake_case event_id (migration 012 event reminders)', () => {
    expect(
      buildRouteFromNotificationData({ screen: '/(protected)/events', event_id: 12 }),
    ).toBe('/(protected)/events?eventId=12');
  });

  it('prefers eventId over event_id when both are present', () => {
    expect(
      buildRouteFromNotificationData({
        screen: '/(protected)/events',
        eventId: 1,
        event_id: 2,
      }),
    ).toBe('/(protected)/events?eventId=1');
  });

  it('does not double-append when the screen already has a query string', () => {
    expect(
      buildRouteFromNotificationData({ screen: '/(protected)/events?eventId=3', eventId: 9 }),
    ).toBe('/(protected)/events?eventId=3');
  });

  it('falls back to the tabs route for disallowed screens', () => {
    expect(buildRouteFromNotificationData({ screen: 'https://evil.example' })).toBe('/(tabs)');
    expect(buildRouteFromNotificationData({ screen: '//evil' })).toBe('/(tabs)');
  });

  it('forwards the F052 weekly-recap week param so a delayed tap opens the right week', () => {
    expect(
      buildRouteFromNotificationData({ screen: '/recap', week: '2026-06-01', period: '2026-06-01' }),
    ).toBe('/recap?week=2026-06-01');
  });

  it('does not append week when the screen already has a query string', () => {
    expect(
      buildRouteFromNotificationData({ screen: '/recap?week=2026-05-25', week: '2026-06-01' }),
    ).toBe('/recap?week=2026-05-25');
  });
});
