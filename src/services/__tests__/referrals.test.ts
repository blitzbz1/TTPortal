import { createQueryChain } from '../../test-utils/supabaseMock';
import { claimReferral, getReferralStats, findProfileByReferralCode } from '../referrals';

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(),
  }),
}));

const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: (...args: any[]) => mockFrom(...args),
  },
}));

beforeEach(() => jest.clearAllMocks());

describe('claimReferral (F041)', () => {
  it('forwards the code to the claim_referral RPC', async () => {
    mockRpc.mockResolvedValue({ data: 'referrer-id', error: null });
    const res = await claimReferral('ABC123');
    expect(mockRpc).toHaveBeenCalledWith('claim_referral', { p_code: 'ABC123' });
    expect(res).toEqual({ data: 'referrer-id', error: null });
  });

  it('passes through an RPC error (e.g. self_referral)', async () => {
    const error = { message: 'self_referral', code: 'P0001' };
    mockRpc.mockResolvedValue({ data: null, error });
    const res = await claimReferral('ABC123');
    expect(res.error).toBe(error);
  });
});

describe('getReferralStats (F041)', () => {
  it('unwraps a single row from the RPC', async () => {
    mockRpc.mockResolvedValue({ data: [{ referral_code: 'CODE12', invited_count: 3 }], error: null });
    const res = await getReferralStats();
    expect(mockRpc).toHaveBeenCalledWith('get_referral_stats');
    expect(res.data).toEqual({ referral_code: 'CODE12', invited_count: 3 });
  });

  it('returns null data when the RPC returns nothing', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const res = await getReferralStats();
    expect(res.data).toBeNull();
  });
});

describe('findProfileByReferralCode (F041)', () => {
  it('returns early for short/garbage codes without querying', async () => {
    const res = await findProfileByReferralCode('ABC');
    expect(res).toEqual({ data: null, error: null });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('looks up the uppercased, trimmed code', async () => {
    const profile = { id: 'u-2', full_name: 'Ana', avatar_url: null, username: 'ana' };
    const chain = createQueryChain(profile, null);
    mockFrom.mockImplementation((table: string) => (table === 'profiles' ? chain : createQueryChain()));

    await findProfileByReferralCode('  abc123 ');

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(chain.eq).toHaveBeenCalledWith('referral_code', 'ABC123');
    expect(chain.maybeSingle).toHaveBeenCalled();
  });
});
