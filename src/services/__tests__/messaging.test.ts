import {
  getOrCreateDmThread,
  sendDm,
  markDmThreadRead,
  canMessage,
  getDmThreads,
  getDmMessages,
  getUnreadDmCount,
} from '../messaging';

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

beforeEach(() => jest.clearAllMocks());

describe('messaging writes (F023)', () => {
  it('getOrCreateDmThread forwards p_other and returns the id', async () => {
    mockRpc.mockResolvedValue({ data: 12, error: null });
    const { data } = await getOrCreateDmThread('u2');
    expect(mockRpc).toHaveBeenCalledWith('get_or_create_dm_thread', { p_other: 'u2' });
    expect(data).toBe(12);
  });

  it('sendDm + markDmThreadRead call their RPCs', async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });
    await sendDm(3, 'hi');
    expect(mockRpc).toHaveBeenCalledWith('send_dm', { p_thread_id: 3, p_body: 'hi' });
    await markDmThreadRead(3);
    expect(mockRpc).toHaveBeenCalledWith('mark_dm_thread_read', { p_thread_id: 3 });
  });

  it('canMessage returns a boolean', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    expect(await canMessage('u2')).toBe(true);
    mockRpc.mockResolvedValue({ data: false, error: null });
    expect(await canMessage('u3')).toBe(false);
    mockRpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    expect(await canMessage('u4')).toBe(false);
  });
});

describe('messaging reads (F023)', () => {
  it('getDmThreads maps rows', async () => {
    mockRpc.mockResolvedValue({
      data: [{
        thread_id: 1, other_id: 'u2', other_name: 'Bob', other_avatar: null,
        last_message: 'yo', last_message_at: 't', unread_count: 2,
      }],
      error: null,
    });
    const { data } = await getDmThreads();
    expect(data[0]).toEqual({
      threadId: 1, otherId: 'u2', otherName: 'Bob', otherAvatar: null,
      lastMessage: 'yo', lastMessageAt: 't', unreadCount: 2,
    });
  });

  it('getDmMessages returns oldest→newest (reverses the newest-first RPC)', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { id: 3, sender_id: 'u', body: 'c', created_at: 't3', is_mine: true },
        { id: 2, sender_id: 'u', body: 'b', created_at: 't2', is_mine: false },
        { id: 1, sender_id: 'u', body: 'a', created_at: 't1', is_mine: true },
      ],
      error: null,
    });
    const { data } = await getDmMessages(1);
    expect(data.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it('getUnreadDmCount defaults to 0', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    expect((await getUnreadDmCount()).data).toBe(0);
  });
});
