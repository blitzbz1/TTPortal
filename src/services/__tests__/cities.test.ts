import { upsertCity } from '../cities';

function createQueryChain(resolvedData: any = [], resolvedError: any = null) {
  const result = { data: resolvedData, error: resolvedError };
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    upsert: jest.fn(() => chain),
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

beforeEach(() => jest.clearAllMocks());

// `getCities` is gone — callers use the delta-synced useCitiesQuery
// hook now (see src/hooks/queries/useCitiesQuery.ts). The hook itself
// has its own integration test in the React Query layer.

describe('upsertCity', () => {
  it('returns existing city id when name matches', async () => {
    // ON CONFLICT (name) DO UPDATE returns the existing row.
    const chain = createQueryChain({ id: 42 });
    mockFrom.mockReturnValue(chain);

    const result = await upsertCity('București');

    expect(result).toEqual({ id: 42, error: null });
    expect(chain.upsert).toHaveBeenCalledWith(
      { name: 'București', active: true },
      expect.objectContaining({ onConflict: 'name', ignoreDuplicates: false }),
    );
  });

  it('returns new city id when no row exists yet', async () => {
    const chain = createQueryChain({ id: 99 });
    mockFrom.mockReturnValue(chain);

    const result = await upsertCity('Sibiu');

    expect(result).toEqual({ id: 99, error: null });
  });

  it('returns error when upsert fails', async () => {
    const chain = createQueryChain(null, { message: 'DB error' });
    mockFrom.mockReturnValue(chain);

    const result = await upsertCity('Brașov');

    expect(result).toEqual({ id: null, error: 'DB error' });
  });
});
