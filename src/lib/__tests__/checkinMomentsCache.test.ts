const mockCachedLoad = jest.fn();
const mockCachedSave = jest.fn();
const mockCachedInvalidate = jest.fn();

jest.mock('../cacheUtils', () => ({
  cachedLoad: (...args: unknown[]) => mockCachedLoad(...args),
  cachedSave: (...args: unknown[]) => mockCachedSave(...args),
  cachedInvalidate: (...args: unknown[]) => mockCachedInvalidate(...args),
}));

import {
  invalidateCheckinMomentsCache,
  loadCachedCheckinMoments,
  saveCachedCheckinMoments,
} from '../checkinMomentsCache';

describe('checkinMomentsCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keys cached moments by venue and viewer so friend-only content cannot leak across accounts', () => {
    loadCachedCheckinMoments(46, 'andra');
    saveCachedCheckinMoments(46, 'andrei', [{ id: 1 }]);
    invalidateCheckinMomentsCache(46, 'andra');

    expect(mockCachedLoad.mock.calls[0][0]).toBe('checkin-moments:46:andra:list');
    expect(mockCachedSave.mock.calls[0][0]).toBe('checkin-moments:46:andrei:list');
    expect(mockCachedInvalidate.mock.calls[0][0]).toBe('checkin-moments:46:andra:list');
  });
});
