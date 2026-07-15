/**
 * Counts Supabase round trips per high-level service call.
 *
 * `mockTrips` is named with the `mock` prefix so Jest's hoist guard allows
 * the factory to reference it.
 */

const mockTrips: { table: string }[] = [];

jest.mock('../../lib/supabase', () => {
  const fixtures: Record<string, any> = {
    friendships: {
      data: [
        { id: 1, requester_id: 'me', addressee_id: 'a', status: 'accepted' },
        { id: 2, requester_id: 'b', addressee_id: 'me', status: 'accepted' },
      ],
      error: null,
    },
    profiles: {
      data: [
        { id: 'a', full_name: 'Alice', avatar_url: null, city: 'X', username: 'alice' },
        { id: 'b', full_name: 'Bob', avatar_url: null, city: 'X', username: 'bob' },
      ],
      error: null,
    },
    events: {
      data: [
        {
          id: 1,
          title: 'E',
          starts_at: new Date().toISOString(),
          venues: { name: 'V', city: 'X', lat: 0, lng: 0 },
          event_participants: [
            { user_id: 'a', hours_played: 1, profiles: { id: 'a', full_name: 'Alice' } },
          ],
        },
      ],
      error: null,
    },
    checkins: { data: [], error: null },
    event_participants: { data: [], error: null },
    venues: { data: [], error: null },
    venue_stats: { data: [], error: null },
  };

  function makeBuilder(payload: any) {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      or: () => builder,
      not: () => builder,
      gte: () => builder,
      lt: () => builder,
      order: () => builder,
      limit: () => builder,
      range: () => builder,
      ilike: () => builder,
      insert: () => builder,
      update: () => builder,
      upsert: () => builder,
      delete: () => builder,
      single: () => builder,
      maybeSingle: () => builder,
      returns: () => builder,
      then: (resolve: (v: any) => void) => resolve(payload),
    };
    return builder;
  }

  return {
    supabase: {
      from: (table: string) => {
        mockTrips.push({ table });
        return makeBuilder(fixtures[table] ?? { data: [], error: null });
      },
    },
  };
});

beforeEach(() => {
  mockTrips.length = 0;
});

describe('Supabase round-trip counts', () => {
  it('getFriends issues 1 query (collapsed via embed)', async () => {
    const { getFriends } = require('../../services/friends');
    await getFriends('me');
     
    console.log(`[bench] getFriends trips: ${mockTrips.map((t) => t.table).join(', ')}`);
    expect(mockTrips.length).toBe(1);
    expect(mockTrips[0].table).toBe('friendships');
  });

  it('getFriendIds issues 1 query', async () => {
    const { getFriendIds } = require('../../services/friends');
    await getFriendIds('me');
    expect(mockTrips.length).toBe(1);
    expect(mockTrips[0].table).toBe('friendships');
  });

  it('getEvents issues 1 query (single embed via FK)', async () => {
    const { getEvents } = require('../../services/events');
    await getEvents('upcoming');
     
    console.log(`[bench] getEvents trips: ${mockTrips.map((t) => t.table).join(', ')}`);
    expect(mockTrips.length).toBe(1);
    expect(mockTrips[0].table).toBe('events');
  });
});
