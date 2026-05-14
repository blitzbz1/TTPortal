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
    const chain = createQueryChain({ id: 42 });
    mockFrom.mockReturnValue(chain);

    const result = await upsertCity('București');

    expect(result).toEqual({ id: 42, error: null });
    expect(chain.select).toHaveBeenCalledWith('id');
    expect(chain.eq).toHaveBeenCalledWith('name', 'București');
    expect(chain.maybeSingle).toHaveBeenCalled();
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it('returns new city id when no row exists yet', async () => {
    const selectChain = createQueryChain(null);
    const insertChain = createQueryChain({ id: 99 });
    mockFrom.mockReturnValueOnce(selectChain).mockReturnValueOnce(insertChain);

    const result = await upsertCity('Sibiu');

    expect(result).toEqual({ id: 99, error: null });
    expect(insertChain.insert).toHaveBeenCalledWith(
      { name: 'Sibiu', active: true },
    );
    expect(insertChain.select).toHaveBeenCalledWith('id');
    expect(insertChain.single).toHaveBeenCalled();
  });

  it('canonicalizes Piatra Neamt variants before upsert', async () => {
    const selectChain = createQueryChain(null);
    const insertChain = createQueryChain({ id: 100 });
    mockFrom.mockReturnValueOnce(selectChain).mockReturnValueOnce(insertChain);

    const result = await upsertCity('Piatra-Neamt');

    expect(result).toEqual({ id: 100, error: null });
    expect(insertChain.insert).toHaveBeenCalledWith(
      { name: 'Piatra Neamț', active: true },
    );
  });

  it('recovers when another browser inserts the city first', async () => {
    const selectChain = createQueryChain(null);
    const insertChain = createQueryChain(null, { code: '23505', message: 'duplicate key value' });
    const raceSelectChain = createQueryChain({ id: 123 });
    mockFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(raceSelectChain);

    const result = await upsertCity('Sibiu');

    expect(result).toEqual({ id: 123, error: null });
    expect(raceSelectChain.eq).toHaveBeenCalledWith('name', 'Sibiu');
  });

  it('returns error when insert fails', async () => {
    const selectChain = createQueryChain(null);
    const insertChain = createQueryChain(null, { message: 'DB error' });
    mockFrom.mockReturnValueOnce(selectChain).mockReturnValueOnce(insertChain);

    const result = await upsertCity('Brașov');

    expect(result).toEqual({ id: null, error: 'DB error' });
  });
});
