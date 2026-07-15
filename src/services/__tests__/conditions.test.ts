// T070: condition-vote upsert semantics (one vote per user per venue, 086).
import { createQueryChain } from '../../test-utils/supabaseMock';
import { submitVote } from '../conditions';

const mockFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

jest.mock('../imageEvidence', () => ({
  uploadVenueEvidenceImage: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

describe('submitVote', () => {
  it('upserts on (user_id, venue_id) so re-voting replaces in place', async () => {
    const chain = createQueryChain({ id: 1 });
    mockFrom.mockReturnValue(chain);
    const vote = { user_id: 'u-1', venue_id: 42, condition: 'buna', photo_url: null, created_at: 't' } as any;
    await submitVote(vote);
    expect(mockFrom).toHaveBeenCalledWith('condition_votes');
    expect(chain.upsert).toHaveBeenCalledWith(vote, { onConflict: 'user_id,venue_id' });
  });
});
