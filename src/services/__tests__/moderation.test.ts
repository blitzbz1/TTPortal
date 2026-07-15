// T070: moderation RPC names/params + report listing.
import { createQueryChain } from '../../test-utils/supabaseMock';
import {
  reportContent,
  blockUser,
  unblockUser,
  getBlockedUsers,
  getUnresolvedReports,
  resolveReport,
} from '../moderation';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

beforeEach(() => jest.clearAllMocks());

describe('reportContent', () => {
  it('stringifies numeric content ids and forwards reason/notes', async () => {
    mockRpc.mockResolvedValue({ data: 7, error: null });
    const { data } = await reportContent('review', 42, 'spam', 'links');
    expect(mockRpc).toHaveBeenCalledWith('report_content', {
      p_content_type: 'review',
      p_content_id: '42',
      p_reason: 'spam',
      p_notes: 'links',
    });
    expect(data).toBe(7);
  });

  it('omits notes when not provided', async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });
    await reportContent('profile', 'u-9', 'harassment');
    expect(mockRpc).toHaveBeenCalledWith('report_content', expect.objectContaining({ p_notes: undefined }));
  });
});

describe('block/unblock', () => {
  it('calls the RPCs with the target id', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await blockUser('u-2');
    expect(mockRpc).toHaveBeenCalledWith('block_user', { p_target_id: 'u-2' });
    await unblockUser('u-2');
    expect(mockRpc).toHaveBeenCalledWith('unblock_user', { p_target_id: 'u-2' });
  });

  it('self-block rejection comes back as an error, not a throw', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'cannot_block_self' } });
    const { error } = await blockUser('me');
    expect(error).toEqual({ message: 'cannot_block_self' });
  });
});

describe('getBlockedUsers', () => {
  it('returns an empty array instead of null', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const { data } = await getBlockedUsers();
    expect(data).toEqual([]);
  });
});

describe('getUnresolvedReports', () => {
  it('queries unresolved reports newest-first', async () => {
    const chain = createQueryChain([{ id: 1 }]);
    mockFrom.mockReturnValue(chain);
    const { data } = await getUnresolvedReports();
    expect(mockFrom).toHaveBeenCalledWith('content_reports');
    expect(chain.is).toHaveBeenCalledWith('resolved_at', null);
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(data).toEqual([{ id: 1 }]);
  });
});

describe('resolveReport', () => {
  it('stamps resolved_at and the resolution', async () => {
    const chain = createQueryChain(null);
    mockFrom.mockReturnValue(chain);
    await resolveReport(5, 'dismissed');
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ resolution: 'dismissed', resolved_at: expect.any(String) }),
    );
    expect(chain.eq).toHaveBeenCalledWith('id', 5);
  });
});
