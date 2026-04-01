jest.mock('../../lib/supabase', () => {
  const selectMock = jest.fn();
  const eqMock = jest.fn();

  const fromMock = jest.fn(() => ({
    select: selectMock.mockReturnValue({
      eq: eqMock.mockResolvedValue({ count: 7, error: null }),
    }),
  }));

  return {
    supabase: {
      from: fromMock,
    },
    __mocks: { fromMock, selectMock, eqMock },
  };
});

import { getUserReviewCount } from '../reviews';
const { __mocks } = require('../../lib/supabase');

describe('getUserReviewCount', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queries reviews table for user_id with count', async () => {
    const result = await getUserReviewCount('user-123');
    expect(__mocks.fromMock).toHaveBeenCalledWith('reviews');
    expect(__mocks.selectMock).toHaveBeenCalledWith('*', { count: 'exact', head: true });
    expect(__mocks.eqMock).toHaveBeenCalledWith('user_id', 'user-123');
    expect(result.data).toBe(7);
  });
});
