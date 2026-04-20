import { createEventFeedback, getEventFeedback, getUserEventFeedback } from '../eventFeedback';

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

function createQueryChain(resolvedData: any = [], resolvedError: any = null) {
  const result = { data: resolvedData, error: resolvedError };
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    order: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(result)),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

const mockFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

describe('eventFeedback service', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── createEventFeedback ──

  describe('createEventFeedback', () => {
    it('inserts feedback and returns single result', async () => {
      const mockResult = { id: 1, event_id: 5, user_id: 'u-1', rating: 5, body: 'Great!' };
      const chain = createQueryChain(mockResult);
      mockFrom.mockReturnValue(chain);

      const feedback = {
        event_id: 5,
        user_id: 'u-1',
        reviewer_name: 'John',
        rating: 5,
        body: 'Great!',
      };

      const { data, error } = await createEventFeedback(feedback);

      expect(mockFrom).toHaveBeenCalledWith('event_feedback');
      expect(chain.insert).toHaveBeenCalledWith(feedback);
      expect(chain.select).toHaveBeenCalled();
      expect(chain.single).toHaveBeenCalled();
      expect(data).toEqual(mockResult);
      expect(error).toBeNull();
    });

    it('returns error on duplicate submission', async () => {
      const chain = createQueryChain(null, { code: '23505', message: 'duplicate key' });
      mockFrom.mockReturnValue(chain);

      const { data, error } = await createEventFeedback({
        event_id: 5,
        user_id: 'u-1',
        reviewer_name: 'John',
        rating: 4,
        body: null,
      });

      expect(data).toBeNull();
      expect(error).toEqual({ code: '23505', message: 'duplicate key' });
    });

    it('sends null body when no text provided', async () => {
      const chain = createQueryChain({ id: 2 });
      mockFrom.mockReturnValue(chain);

      await createEventFeedback({
        event_id: 3,
        user_id: 'u-2',
        reviewer_name: null,
        rating: 3,
        body: null,
      });

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ body: null, reviewer_name: null }),
      );
    });
  });

  // ── getEventFeedback ──

  describe('getEventFeedback', () => {
    it('fetches all feedback for an event ordered by created_at desc', async () => {
      const mockFeedback = [
        { id: 2, event_id: 5, rating: 5 },
        { id: 1, event_id: 5, rating: 4 },
      ];
      const chain = createQueryChain(mockFeedback);
      mockFrom.mockReturnValue(chain);

      const { data, error } = await getEventFeedback(5);

      expect(mockFrom).toHaveBeenCalledWith('event_feedback');
      expect(chain.select).toHaveBeenCalledWith(
        'id, event_id, user_id, reviewer_name, rating, body, created_at',
      );
      expect(chain.eq).toHaveBeenCalledWith('event_id', 5);
      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(data).toHaveLength(2);
      expect(error).toBeNull();
    });

    it('returns empty array when no feedback exists', async () => {
      const chain = createQueryChain([]);
      mockFrom.mockReturnValue(chain);

      const { data } = await getEventFeedback(99);

      expect(data).toEqual([]);
    });
  });

  // ── getUserEventFeedback ──

  describe('getUserEventFeedback', () => {
    it('returns feedback row when user has submitted', async () => {
      const chain = createQueryChain({ id: 7 });
      mockFrom.mockReturnValue(chain);

      const { data } = await getUserEventFeedback(5, 'u-1');

      expect(mockFrom).toHaveBeenCalledWith('event_feedback');
      expect(chain.eq).toHaveBeenCalledWith('event_id', 5);
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'u-1');
      expect(chain.maybeSingle).toHaveBeenCalled();
      expect(data).toEqual({ id: 7 });
    });

    it('returns null when user has not submitted feedback', async () => {
      const chain = createQueryChain(null);
      mockFrom.mockReturnValue(chain);

      const { data } = await getUserEventFeedback(5, 'u-2');

      expect(data).toBeNull();
    });
  });
});
