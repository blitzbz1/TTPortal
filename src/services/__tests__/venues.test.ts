import { createVenue } from '../venues';

const mockRemoveCacheItemsByPrefix = jest.fn();
jest.mock('../../lib/cacheUtils', () => ({
  removeCacheItemsByPrefix: (...args: any[]) => mockRemoveCacheItemsByPrefix(...args),
}));

const mockInsert = jest.fn();
const mockFrom = jest.fn((..._args: any[]) => ({ insert: mockInsert }));

jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockInsert.mockResolvedValue({ data: null, error: null });
});

describe('createVenue', () => {
  it('does not select the pending venue back after insert', async () => {
    const result = await createVenue({
      name: 'New Place',
      type: 'parc_exterior',
      city: 'Sibiu',
      city_id: 99,
      county: null,
      sector: null,
      address: 'Strada Test',
      lat: 45.8,
      lng: 24.1,
      tables_count: 2,
      condition: null,
      hours: null,
      description: null,
      tags: null,
      photos: null,
      free_access: null,
      night_lighting: null,
      nets: null,
      tariff: null,
      website: null,
      approved: false,
    } as any);

    expect(result).toEqual({ data: null, error: null });
    expect(mockFrom).toHaveBeenCalledWith('venues');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'New Place',
      approved: false,
    }));
    expect(mockRemoveCacheItemsByPrefix).toHaveBeenCalledWith('venues_');
  });

  it('keeps venue caches when insert fails', async () => {
    mockInsert.mockResolvedValue({ data: null, error: { message: 'RLS failure' } });

    const result = await createVenue({ name: 'Bad Place' } as any);

    expect(result.error).toEqual({ message: 'RLS failure' });
    expect(mockRemoveCacheItemsByPrefix).not.toHaveBeenCalled();
  });
});
