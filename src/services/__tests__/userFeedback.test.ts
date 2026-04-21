import { submitUserFeedback } from '../userFeedback';

function createQueryChain(resolvedData: any = null, resolvedError: any = null) {
  const result = { data: resolvedData, error: resolvedError };
  const chain: any = {
    select: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(result)),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

const mockFrom = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

describe('submitUserFeedback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('routes bug category to user_feedback with trimmed message', async () => {
    const chain = createQueryChain({ id: 'f-1' });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await submitUserFeedback({
      userId: 'u-1',
      userEmail: 'u@x.com',
      page: '/profile',
      category: 'bug',
      message: '   The app crashes on login   ',
    });

    expect(mockFrom).toHaveBeenCalledWith('user_feedback');
    expect(chain.insert).toHaveBeenCalledWith({
      user_id: 'u-1',
      page: '/profile',
      category: 'bug',
      message: 'The app crashes on login',
    });
    expect(data).toEqual({ id: 'f-1' });
    expect(error).toBeNull();
  });

  it('routes general category to user_feedback', async () => {
    const chain = createQueryChain({ id: 'f-2' });
    mockFrom.mockReturnValue(chain);

    await submitUserFeedback({
      userId: 'u-2',
      userEmail: null,
      page: '/events',
      category: 'general',
      message: 'Love the new design',
    });

    expect(mockFrom).toHaveBeenCalledWith('user_feedback');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'general', message: 'Love the new design' }),
    );
  });

  it('routes feature category to feature_requests with title + author email', async () => {
    const chain = createQueryChain({ id: 'fr-1' });
    mockFrom.mockReturnValue(chain);

    await submitUserFeedback({
      userId: 'u-3',
      userEmail: 'alex@example.com',
      page: '/map',
      category: 'feature',
      message: 'Please add dark map tiles with a toggle in settings.',
      featureTitle: 'Dark map tiles',
    });

    expect(mockFrom).toHaveBeenCalledWith('feature_requests');
    expect(chain.insert).toHaveBeenCalledWith({
      title: 'Dark map tiles',
      description: 'Please add dark map tiles with a toggle in settings.',
      category: 'General',
      author_id: 'u-3',
      author_email: 'alex@example.com',
    });
  });

  it('feature falls back to first line of message when title is empty', async () => {
    const chain = createQueryChain({ id: 'fr-2' });
    mockFrom.mockReturnValue(chain);

    await submitUserFeedback({
      userId: 'u-4',
      userEmail: null,
      page: '/events',
      category: 'feature',
      message: 'Invite friends via link\nMulti-line detail goes here.',
    });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Invite friends via link',
        description: 'Invite friends via link\nMulti-line detail goes here.',
        author_email: null,
      }),
    );
  });

  it('caps feature title to 200 characters', async () => {
    const chain = createQueryChain({ id: 'fr-3' });
    mockFrom.mockReturnValue(chain);
    const longTitle = 'a'.repeat(300);

    await submitUserFeedback({
      userId: 'u-5',
      userEmail: null,
      page: '/x',
      category: 'feature',
      message: 'details',
      featureTitle: longTitle,
    });

    const args = chain.insert.mock.calls[0][0];
    expect(args.title).toHaveLength(200);
  });

  it('surfaces supabase error', async () => {
    const chain = createQueryChain(null, { code: '42501', message: 'rls denied' });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await submitUserFeedback({
      userId: 'u-6',
      userEmail: null,
      page: '/x',
      category: 'bug',
      message: 'nope',
    });

    expect(data).toBeNull();
    expect(error).toEqual({ code: '42501', message: 'rls denied' });
  });
});
