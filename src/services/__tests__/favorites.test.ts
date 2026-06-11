// T070: favorites CRUD + domain-cache invalidation coupling.
import { createQueryChain } from '../../test-utils/supabaseMock';
import { getFavorites, addFavorite, removeFavorite, isFavorite } from '../favorites';

const mockFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

const mockInvalidate = jest.fn();
jest.mock('../../lib/favoritesCache', () => ({
  invalidateFavoritesCache: (...args: any[]) => mockInvalidate(...args),
}));

beforeEach(() => jest.clearAllMocks());

describe('getFavorites', () => {
  it('queries the user, newest first, capped at 100', async () => {
    const chain = createQueryChain([{ id: 1 }]);
    mockFrom.mockReturnValue(chain);
    const { data } = await getFavorites('u-1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u-1');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(100);
    expect(data).toEqual([{ id: 1 }]);
  });
});

describe('addFavorite', () => {
  it('inserts and invalidates the domain cache on success', async () => {
    mockFrom.mockReturnValue(createQueryChain({ id: 1 }));
    await addFavorite('u-1', 42);
    expect(mockInvalidate).toHaveBeenCalledWith('u-1');
  });

  it('does NOT invalidate on error', async () => {
    mockFrom.mockReturnValue(createQueryChain(null, { message: 'dup' }));
    await addFavorite('u-1', 42);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});

describe('removeFavorite', () => {
  it('deletes the pair and invalidates on success', async () => {
    const chain = createQueryChain(null);
    mockFrom.mockReturnValue(chain);
    await removeFavorite('u-1', 42);
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('venue_id', 42);
    expect(mockInvalidate).toHaveBeenCalledWith('u-1');
  });
});

describe('isFavorite', () => {
  it('maps a found row to true and a miss to false', async () => {
    mockFrom.mockReturnValue(createQueryChain({ id: 1 }));
    expect((await isFavorite('u-1', 42)).data).toBe(true);
    mockFrom.mockReturnValue(createQueryChain(null));
    expect((await isFavorite('u-1', 42)).data).toBe(false);
  });
});
