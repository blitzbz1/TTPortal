import { getCities, upsertCity } from '../cities';

function createQueryChain(resolvedData: any = [], resolvedError: any = null) {
  const result = { data: resolvedData, error: resolvedError };
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    insert: jest.fn(() => chain),
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

describe('getCities', () => {
  it('fetches active cities ordered by name', async () => {
    const cities = [{ id: 1, name: 'București' }, { id: 2, name: 'Cluj-Napoca' }];
    const chain = createQueryChain(cities);
    mockFrom.mockReturnValue(chain);

    const { data } = await getCities();

    expect(mockFrom).toHaveBeenCalledWith('cities');
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.eq).toHaveBeenCalledWith('active', true);
    expect(chain.order).toHaveBeenCalledWith('name');
    expect(data).toEqual(cities);
  });
});

describe('upsertCity', () => {
  it('returns existing city id when city already exists', async () => {
    const chain = createQueryChain({ id: 42 });
    mockFrom.mockReturnValue(chain);

    const result = await upsertCity('București');

    expect(result).toEqual({ id: 42, error: null });
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it('inserts new city when it does not exist', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call: select returns null (city not found)
        return createQueryChain(null);
      }
      // Second call: insert returns new city
      return createQueryChain({ id: 99 });
    });

    const result = await upsertCity('Sibiu');

    expect(result).toEqual({ id: 99, error: null });
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('returns error when select fails', async () => {
    const chain = createQueryChain(null, { message: 'DB error' });
    mockFrom.mockReturnValue(chain);

    const result = await upsertCity('Brașov');

    expect(result).toEqual({ id: null, error: 'DB error' });
  });

  it('returns error when insert fails', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return createQueryChain(null); // not found
      }
      return createQueryChain(null, { message: 'Unique violation' }); // insert fails
    });

    const result = await upsertCity('Duplicat');

    expect(result).toEqual({ id: null, error: 'Unique violation' });
  });
});
