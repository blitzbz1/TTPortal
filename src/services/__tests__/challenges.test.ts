import {
  addChallengeToEvent,
  awardEventChallengeSubmission,
  completeSelfChallenge,
  getChallengeChoices,
  getUserBadgeAwards,
  getUserBadgeProgress,
} from '../challenges';

function createQueryChain(resolvedData: any = [], resolvedError: any = null) {
  const result = { data: resolvedData, error: resolvedError };
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

describe('challenge RPC wrappers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches four challenge choices for a category', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await getChallengeChoices('serve_lab', 4);

    expect(mockRpc).toHaveBeenCalledWith('get_challenge_choices', {
      v_category: 'serve_lab',
      v_limit_count: 4,
    });
  });

  it('completes a self challenge through the atomic RPC', async () => {
    mockRpc.mockResolvedValue({ data: { id: 'submission-1' }, error: null });

    await completeSelfChallenge('challenge-1');

    expect(mockRpc).toHaveBeenCalledWith('complete_self_challenge', {
      v_challenge_id: 'challenge-1',
    });
  });

  it('adds the current challenge to an event', async () => {
    mockRpc.mockResolvedValue({ data: { id: 'submission-2' }, error: null });

    await addChallengeToEvent(12, 'challenge-2');

    expect(mockRpc).toHaveBeenCalledWith('add_challenge_to_event', {
      v_event_id: 12,
      v_challenge_id: 'challenge-2',
    });
  });

  it('awards event challenge completion first-come through RPC', async () => {
    mockRpc.mockResolvedValue({ data: { id: 'submission-3', status: 'approved' }, error: null });

    await awardEventChallengeSubmission('submission-3');

    expect(mockRpc).toHaveBeenCalledWith('award_event_challenge_submission', {
      v_submission_id: 'submission-3',
    });
  });
});

describe('challenge table wrappers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads badge progress rows for one user', async () => {
    const chain = createQueryChain([{ category: 'serve_lab', completed_count: 5 }]);
    mockFrom.mockReturnValue(chain);

    await getUserBadgeProgress('user-1');

    expect(mockFrom).toHaveBeenCalledWith('user_badge_progress');
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('loads durable badge awards ordered by award date', async () => {
    const chain = createQueryChain([{ category: 'serve_lab', tier: 'bronze' }]);
    mockFrom.mockReturnValue(chain);

    await getUserBadgeAwards('user-1');

    expect(mockFrom).toHaveBeenCalledWith('badge_awards');
    expect(chain.select).toHaveBeenCalledWith('*');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(chain.order).toHaveBeenCalledWith('awarded_at', { ascending: true });
  });
});
