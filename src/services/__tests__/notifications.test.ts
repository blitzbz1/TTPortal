// T070: notification list/read/delete scoping — every mutation must be
// scoped to the recipient (RLS backs this, but a missing .eq here would
// fan out to the wrong rows under the definer paths).
import { createQueryChain } from '../../test-utils/supabaseMock';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} from '../notifications';

const mockFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

beforeEach(() => jest.clearAllMocks());

describe('getNotifications', () => {
  it('pages with range and embeds the sender profile', async () => {
    const chain = createQueryChain([]);
    mockFrom.mockReturnValue(chain);
    await getNotifications('u-1', 20, 40);
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('sender:profiles!notifications_sender_profiles_fk'));
    expect(chain.eq).toHaveBeenCalledWith('recipient_id', 'u-1');
    expect(chain.range).toHaveBeenCalledWith(40, 59);
  });
});

describe('mutations are recipient-scoped', () => {
  it('markAsRead scopes to id + recipient', async () => {
    const chain = createQueryChain(null);
    mockFrom.mockReturnValue(chain);
    await markAsRead(7, 'u-1');
    expect(chain.update).toHaveBeenCalledWith({ read: true });
    expect(chain.eq).toHaveBeenCalledWith('id', 7);
    expect(chain.eq).toHaveBeenCalledWith('recipient_id', 'u-1');
  });

  it('markAllAsRead only touches unread rows of the recipient', async () => {
    const chain = createQueryChain(null);
    mockFrom.mockReturnValue(chain);
    await markAllAsRead('u-1');
    expect(chain.eq).toHaveBeenCalledWith('recipient_id', 'u-1');
    expect(chain.eq).toHaveBeenCalledWith('read', false);
  });

  it('deleteNotification / deleteAllNotifications scope to the recipient', async () => {
    const chain = createQueryChain(null);
    mockFrom.mockReturnValue(chain);
    await deleteNotification(7, 'u-1');
    expect(chain.eq).toHaveBeenCalledWith('id', 7);
    expect(chain.eq).toHaveBeenCalledWith('recipient_id', 'u-1');

    const chain2 = createQueryChain(null);
    mockFrom.mockReturnValue(chain2);
    await deleteAllNotifications('u-1');
    expect(chain2.delete).toHaveBeenCalled();
    expect(chain2.eq).toHaveBeenCalledWith('recipient_id', 'u-1');
  });
});
